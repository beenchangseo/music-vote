#!/usr/bin/env bash
# Supabase 프로젝트를 다른 리전의 새 프로젝트로 옮긴다.
# 절차는 docs/plans/2026-09-20-supabase-region-migration.md 를 따른다.
#
#   export SOURCE_DB_URL='postgresql://...'   # 기존 프로젝트
#   export TARGET_DB_URL='postgresql://...'   # 신규 프로젝트
#   bash scripts/migrate-supabase-region.sh
#
# 연결 문자열은 비밀번호를 담고 있다. 파일에 적지 말고 셸 변수로만 넘긴다.

set -euo pipefail

OUT_DIR=".migration"
PSQL="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"

fail() { echo "  실패: $*" >&2; exit 1; }

[ -n "${SOURCE_DB_URL:-}" ] || fail "SOURCE_DB_URL 이 없습니다."
[ -n "${TARGET_DB_URL:-}" ] || fail "TARGET_DB_URL 이 없습니다."
[ "$SOURCE_DB_URL" != "$TARGET_DB_URL" ] || fail "원본과 대상이 같습니다."
command -v supabase >/dev/null || fail "supabase CLI 가 없습니다. brew install supabase/tap/supabase"
[ -x "$PSQL" ] || fail "psql 을 찾을 수 없습니다: $PSQL (PSQL_BIN 으로 지정 가능)"

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
# session_replication_role = replica 로 트리거를 끈다.
# 켜둔 채 복원하면 auth 컬럼이 이중 암호화된다.
"$PSQL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$OUT_DIR/roles.sql" \
  --file "$OUT_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$OUT_DIR/data.sql" \
  --dbname "$TARGET_DB_URL"

echo
echo "복원이 끝났습니다. 다음을 이어서 하세요."
echo "  1) node scripts/compare-supabase-projects.mjs   # 행 수 대조"
echo "  2) 신규 프로젝트에 카카오 provider 설정"
echo "  3) Vercel 환경변수 3개 교체 후 재배포"
echo
echo "검증이 끝나면 덤프를 지우세요: rm -rf $OUT_DIR"
