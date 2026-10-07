#!/usr/bin/env bash
# Supabase 프로젝트를 다른 리전의 새 프로젝트로 옮긴다.
# 절차는 docs/plans/2026-09-20-supabase-region-migration.md 를 따른다.
#
#   export SOURCE_DB_URL='postgresql://...'   # 기존 프로젝트 (Session pooler)
#   export TARGET_DB_URL='postgresql://...'   # 신규 프로젝트 (Session pooler)
#
#   bash scripts/migrate-supabase-region.sh --dump-only     # 얼리기 전 시험 덤프 (런북 2-0). 복원하지 않는다
#   bash scripts/migrate-supabase-region.sh                 # 전환: 덤프 + 복원. 원본이 얼려 있어야 한다 (런북 2-1)
#   bash scripts/migrate-supabase-region.sh --restore-only  # 복원 실패 뒤 덤프를 손보고 복원만 다시 (런북 2-3)
#   --rehearsal 을 함께 주면 원본을 얼리지 않아도 진행한다 (로컬 시험용)
#
# 연결 문자열은 비밀번호를 담고 있다. 파일에 적지 말고 셸 변수로만 넘긴다.

set -euo pipefail

OUT_DIR=".migration"
DRY_DIR="$OUT_DIR/dry-run"
PSQL="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"
MODE=full
REHEARSAL=false
for arg in "$@"; do
  case "$arg" in
    --dump-only) MODE=dump ;;
    --restore-only) MODE=restore ;;
    --rehearsal) REHEARSAL=true ;;
    *) echo "  알 수 없는 옵션: $arg" >&2; exit 1 ;;
  esac
done

fail() { echo "  실패: $*" >&2; exit 1; }

[ -n "${SOURCE_DB_URL:-}" ] || fail "SOURCE_DB_URL 이 없습니다."
[ -n "${TARGET_DB_URL:-}" ] || fail "TARGET_DB_URL 이 없습니다."
[ "$SOURCE_DB_URL" != "$TARGET_DB_URL" ] || fail "원본과 대상이 같습니다."
[ -x "$PSQL" ] || fail "psql 을 찾을 수 없습니다: $PSQL (PSQL_BIN 으로 지정 가능)"
if [ "$MODE" != restore ]; then
  command -v supabase >/dev/null || fail "supabase CLI 가 없습니다. brew install supabase/tap/supabase"
  docker info >/dev/null 2>&1 || fail "Docker 가 꺼져 있습니다. supabase db dump 는 Docker 안에서 돈다."
fi

q() { # $1=db_url $2=sql
  "$PSQL" -X -At -v ON_ERROR_STOP=1 -d "$1" -c "$2"
}

# 신규 프로젝트는 postgres 가 public 에 만드는 테이블·시퀀스·함수에 anon·authenticated·service_role 권한을
# 자동으로 붙인다. pg_dump 는 권한을 "기본 권한이 없는 상태" 기준으로 적으므로, 원본에서 REVOKE 로 닫은
# 권한(v11·v15·v17~v20)을 다시 닫는 문장이 덤프에 없다. schema.sql 앞에서 자동 부여를 꺼야 복원된 권한이
# 원본과 같아진다.
PRE_RESTORE_SQL="
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;"

# 앞으로 만들 객체의 기본 권한은 원본(= 신규 생성 직후)과 같게 되돌린다. 이전은 동작을 바꾸지 않는다.
# schema.sql 이 이미 되돌렸다면 아무 일도 하지 않는다.
POST_RESTORE_SQL="
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;"

dump_all() { # $1=dir
  mkdir -p "$1"
  local out cli_dir
  out=$(cd "$1" && pwd)
  # CLI 는 작업 폴더의 .env·.env.local 을 읽고, 해석하지 못하는 줄이 있으면 멈춘다.
  # 앱용 env 파일에 휘둘리지 않게 빈 임시 폴더에서 돌린다.
  cli_dir=$(mktemp -d)
  (
    cd "$cli_dir"
    echo "1/4  역할 덤프"
    supabase db dump --db-url "$SOURCE_DB_URL" -f "$out/roles.sql" --role-only
    echo "2/4  스키마 덤프"
    supabase db dump --db-url "$SOURCE_DB_URL" -f "$out/schema.sql"
    echo "3/4  데이터 덤프"
    supabase db dump --db-url "$SOURCE_DB_URL" -f "$out/data.sql" \
      --use-copy --data-only \
      -x "storage.buckets_vectors" -x "storage.vector_indexes"
  )
  rm -rf "$cli_dir"
}

check_files() { # $1=dir
  for f in roles schema data; do
    [ -s "$1/$f.sql" ] || fail "$1/$f.sql 이 없거나 비어 있습니다."
    printf "     %-8s %s\n" "$f.sql" "$(wc -c < "$1/$f.sql" | tr -d ' ') bytes"
  done
}

echo "0/4  사전 점검"

# 세션 값(SHOW)은 풀러가 얼리기 전 연결을 재사용하면 off 로 보일 수 있어, DB 설정 자체를 읽는다.
source_ro=$(q "$SOURCE_DB_URL" "
SELECT coalesce(
  (SELECT split_part(cfg, '=', 2)
   FROM pg_db_role_setting s, unnest(s.setconfig) cfg
   WHERE s.setrole = 0
     AND s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
     AND cfg LIKE 'default_transaction_read_only=%'),
  'off')")
if [ "$source_ro" = "on" ]; then
  echo "     원본 읽기 전용: on"
elif [ "$MODE" = dump ] || $REHEARSAL; then
  echo "     원본 읽기 전용: $source_ro (시험 덤프·리허설이라 계속한다)"
else
  fail "원본이 읽기 전용이 아닙니다($source_ro). 런북 2-1 로 먼저 얼리세요."
fi

# 대상은 비어 있어야 한다. 복원 전에 누가 로그인했거나 이전 시도가 남아 있으면 여기서 멈춘다.
target_used=$(q "$TARGET_DB_URL" "
SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S'))
     + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public')
     + (SELECT count(*) FROM auth.users)")
[ "$target_used" = "0" ] || fail "대상이 비어 있지 않습니다 (public 객체 + auth.users = $target_used). 런북 0-2 를 다시 보세요."
echo "     대상 비어 있음"

# 원본은 citext 를 public 에 둔다. 대상에 다른 스키마로 이미 깔려 있으면 schema.sql 이 public.citext 를 못 찾는다.
target_citext=$(q "$TARGET_DB_URL" "SELECT coalesce((SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'citext'), '')")
if [ -n "$target_citext" ] && [ "$target_citext" != "public" ]; then
  fail "대상에 citext 가 $target_citext 스키마로 설치돼 있습니다. DROP EXTENSION citext; 후 다시 실행하세요."
fi
echo "     citext 충돌 없음"

if [ "$MODE" = dump ]; then
  # 얼리기 전 시험이라 전환용 덤프와 다른 폴더에 둔다. 이 덤프로 복원하면 얼리기 전 데이터가 들어간다.
  dump_all "$DRY_DIR"
  check_files "$DRY_DIR"
  echo
  echo "알려진 복원 오류 점검 (런북 2-3 표)"
  printf "     %-44s %s\n" 'schema.sql: OWNER TO "supabase_admin"' "$(grep -c 'OWNER TO "supabase_admin"' "$DRY_DIR/schema.sql" || true)줄"
  printf "     %-44s %s\n" 'roles.sql: cli_login_postgres' "$(grep -c 'cli_login_postgres' "$DRY_DIR/roles.sql" || true)줄"
  printf "     %-44s %s\n" 'schema.sql: GRANT' "$(grep -c '^GRANT ' "$DRY_DIR/schema.sql" || true)줄 (0 이면 권한이 안 실린 것)"
  printf "     %-44s %s\n" 'schema.sql: ALTER DEFAULT PRIVILEGES' "$(grep -c '^ALTER DEFAULT PRIVILEGES' "$DRY_DIR/schema.sql" || true)줄"
  printf "     %-44s %s\n" 'schema.sql: citext 생성' "$(grep -i 'CREATE EXTENSION.*citext' "$DRY_DIR/schema.sql" | head -1 || true)"
  echo
  echo "시험 덤프가 끝났습니다. 복원은 하지 않았습니다. 확인 뒤 지우세요: rm -rf $DRY_DIR"
  exit 0
fi

if [ "$MODE" = full ]; then
  dump_all "$OUT_DIR"
  # --restore-only 가 얼린 뒤의 덤프인지 확인할 수 있게 남긴다.
  printf 'source_read_only=%s\ndumped_at=%s\n' "$source_ro" "$(date '+%Y-%m-%dT%H:%M:%S%z')" > "$OUT_DIR/dump.meta"
else
  echo "1-3/4  덤프 건너뜀 (--restore-only) — $OUT_DIR 의 파일을 그대로 쓴다"
  [ -f "$OUT_DIR/dump.meta" ] || fail "$OUT_DIR/dump.meta 가 없습니다. 전환 모드로 뜬 덤프만 다시 복원할 수 있습니다."
  if ! $REHEARSAL && ! grep -q '^source_read_only=on$' "$OUT_DIR/dump.meta"; then
    fail "이 덤프는 원본을 얼리기 전에 떴습니다. 얼린 뒤 전환 모드로 다시 뜨세요."
  fi
  sed 's/^/     /' "$OUT_DIR/dump.meta"
fi
check_files "$OUT_DIR"

echo "4/4  대상 프로젝트로 복원"
# 한 트랜잭션이라 중간에 실패하면 대상은 빈 상태로 돌아간다.
# session_replication_role = replica 로 트리거를 끈다. 켜둔 채 복원하면 auth 컬럼이 이중 암호화된다.
# 명령 결과는 로그로 보내고 오류만 화면에 남긴다.
if ! "$PSQL" \
  -X \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$OUT_DIR/roles.sql" \
  --command "$PRE_RESTORE_SQL" \
  --file "$OUT_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$OUT_DIR/data.sql" \
  --command "$POST_RESTORE_SQL" \
  --dbname "$TARGET_DB_URL" \
  > "$OUT_DIR/restore.log"; then
  echo
  echo "  복원이 실패해 트랜잭션 전체가 되돌아갔습니다. 대상은 빈 상태입니다."
  echo "  위 오류를 런북 2-3 의 표와 맞춰 보고 $OUT_DIR 의 파일을 고친 뒤:"
  echo "    bash scripts/migrate-supabase-region.sh --restore-only"
  exit 1
fi
echo "     복원 로그: $OUT_DIR/restore.log"

echo
echo "복원이 끝났습니다. 런북 2-4 검증을 이어서 하세요."
echo "  1) bash scripts/compare-supabase-projects.sh   # 행 수·구조·권한·기본 권한 대조"
echo "  2) 신규 URL·publishable 키로 node scripts/audit-anon-access.mjs"
echo "  3) 로컬 앱을 신규 프로젝트에 붙여 확인"
echo
echo "덤프에는 사용자 개인정보가 들어 있습니다. 검증이 끝나면 지우세요: rm -rf $OUT_DIR"
