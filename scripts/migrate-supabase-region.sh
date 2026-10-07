#!/usr/bin/env bash
# Supabase 프로젝트를 다른 리전의 새 프로젝트로 옮긴다.
# 절차는 docs/plans/2026-09-20-supabase-region-migration.md 를 따른다.
#
#   export SOURCE_DB_URL='postgresql://...'   # 기존 프로젝트 (Session pooler)
#   export TARGET_DB_URL='postgresql://...'   # 신규 프로젝트 (Session pooler)
#   bash scripts/migrate-supabase-region.sh               # 전환: 원본이 얼려 있어야 한다 (런북 2-1)
#   bash scripts/migrate-supabase-region.sh --rehearsal   # 리허설: 원본을 얼리지 않고 진행
#
# 연결 문자열은 비밀번호를 담고 있다. 파일에 적지 말고 셸 변수로만 넘긴다.

set -euo pipefail

OUT_DIR=".migration"
PSQL="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"
REHEARSAL=false
[ "${1:-}" = "--rehearsal" ] && REHEARSAL=true

fail() { echo "  실패: $*" >&2; exit 1; }

[ -n "${SOURCE_DB_URL:-}" ] || fail "SOURCE_DB_URL 이 없습니다."
[ -n "${TARGET_DB_URL:-}" ] || fail "TARGET_DB_URL 이 없습니다."
[ "$SOURCE_DB_URL" != "$TARGET_DB_URL" ] || fail "원본과 대상이 같습니다."
command -v supabase >/dev/null || fail "supabase CLI 가 없습니다. brew install supabase/tap/supabase"
docker info >/dev/null 2>&1 || fail "Docker 가 꺼져 있습니다. supabase db dump 는 Docker 안에서 돈다."
[ -x "$PSQL" ] || fail "psql 을 찾을 수 없습니다: $PSQL (PSQL_BIN 으로 지정 가능)"

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
elif $REHEARSAL; then
  echo "     원본 읽기 전용: $source_ro (리허설이라 계속한다)"
else
  fail "원본이 읽기 전용이 아닙니다($source_ro). 런북 2-1 로 먼저 얼리세요. 리허설이면 --rehearsal."
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

mkdir -p "$OUT_DIR"

echo "1/4  역할 덤프"
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT_DIR/roles.sql" --role-only

echo "2/4  스키마 덤프"
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT_DIR/schema.sql"

echo "3/4  데이터 덤프"
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT_DIR/data.sql" \
  --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"

for f in roles schema data; do
  [ -s "$OUT_DIR/$f.sql" ] || fail "$OUT_DIR/$f.sql 이 비어 있습니다."
  printf "     %-8s %s\n" "$f.sql" "$(wc -c < "$OUT_DIR/$f.sql" | tr -d ' ') bytes"
done

echo "4/4  대상 프로젝트로 복원"
# 한 트랜잭션이라 중간에 실패하면 대상은 빈 상태로 돌아간다.
# session_replication_role = replica 로 트리거를 끈다. 켜둔 채 복원하면 auth 컬럼이 이중 암호화된다.
# 명령 결과는 로그로 보내고 오류만 화면에 남긴다.
"$PSQL" \
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
  > "$OUT_DIR/restore.log"
echo "     복원 로그: $OUT_DIR/restore.log"

echo
echo "복원이 끝났습니다. 런북 2-4 검증을 이어서 하세요."
echo "  1) bash scripts/compare-supabase-projects.sh   # 행 수·구조·권한·기본 권한 대조"
echo "  2) 신규 URL·publishable 키로 node scripts/audit-anon-access.mjs"
echo "  3) 로컬 앱을 신규 프로젝트에 붙여 확인"
echo
echo "덤프에는 사용자 개인정보가 들어 있습니다. 검증이 끝나면 지우세요: rm -rf $OUT_DIR"
