#!/usr/bin/env bash
# 두 Supabase 프로젝트를 대조한다. 읽기만 한다.
# 절차는 docs/plans/2026-09-20-supabase-region-migration.md 를 따른다.
#
#   export SOURCE_DB_URL='postgresql://...'
#   export TARGET_DB_URL='postgresql://...'
#   bash scripts/compare-supabase-projects.sh
#
#   bash scripts/compare-supabase-projects.sh --source-only   # 전환 직전 원본 현황 기록용
#
# 대조 항목 — 하나라도 다르면 종료 코드 1
#   1) 행 수    public 의 모든 테이블 + auth.users + auth.identities (테이블 목록은 원본에서 읽는다)
#   2) 구조     테이블·뷰·함수·정책 개수, RLS 꺼진 public 테이블 수
#   3) 권한     public 객체에 anon·authenticated·service_role·PUBLIC 이 가진 권한
#   4) 기본 권한 public 에 새로 만드는 객체에 자동으로 붙는 권한
#
# auth.users 가 어긋나면 방장 권한과 투표 기록이 끊어진다.
# 권한이 어긋나면 v11·v15·v17~v20 이 닫아둔 공개 키 경로가 다시 열린 것이다.

set -euo pipefail

PSQL="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"
SOURCE_ONLY=false
[ "${1:-}" = "--source-only" ] && SOURCE_ONLY=true

fail() { echo "  실패: $*" >&2; exit 1; }

[ -n "${SOURCE_DB_URL:-}" ] || fail "SOURCE_DB_URL 이 없습니다."
$SOURCE_ONLY || [ -n "${TARGET_DB_URL:-}" ] || fail "TARGET_DB_URL 이 없습니다."
[ -x "$PSQL" ] || fail "psql 을 찾을 수 없습니다: $PSQL (PSQL_BIN 으로 지정 가능)"

TABLES_SQL="
SELECT format('%I.%I', n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY 1"

STRUCTURE_SQL="
SELECT 'tables', count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
UNION ALL
SELECT 'views', count(*) FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT 'functions', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
UNION ALL
SELECT 'policies', count(*) FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'rls_off_tables', count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity"

# 객체별·역할별 권한 한 줄씩. 확장이 만든 함수(citext 등)는 뺀다.
GRANTS_SQL="
WITH objs AS (
  SELECT c.relname::text AS obj, c.relkind::text AS kind, c.relacl AS acl, c.relowner AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'S')
  UNION ALL
  SELECT p.oid::regprocedure::text, 'f', p.proacl, p.proowner
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
), grants AS (
  SELECT o.kind, o.obj,
         CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
         a.privilege_type
  FROM objs o,
       aclexplode(coalesce(o.acl, acldefault(CASE o.kind WHEN 'f' THEN 'f' WHEN 'S' THEN 's' ELSE 'r' END::\"char\", o.owner))) a
)
SELECT kind || ':' || obj || ':' || grantee || ':' || string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM grants
WHERE grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
GROUP BY kind, obj, grantee
ORDER BY kind, obj, grantee"

# aclitem 배열 순서는 DB 마다 다를 수 있어 풀어서 정렬한다.
DEFAULT_ACL_SQL="
SELECT pg_get_userbyid(d.defaclrole) || ':' || d.defaclobjtype::text || ':' ||
       CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || ':' ||
       string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
FROM pg_default_acl d, aclexplode(d.defaclacl) a
WHERE d.defaclnamespace = 'public'::regnamespace
GROUP BY d.defaclrole, d.defaclobjtype, a.grantee
ORDER BY 1"

q() { # $1=db_url $2=sql
  "$PSQL" -X -At -F ' ' -v ON_ERROR_STOP=1 -d "$1" -c "$2"
}

count() { # $1=db_url $2=table
  q "$1" "SELECT count(*) FROM $2" 2>/dev/null || echo "ERR"
}

fingerprint() { # stdin=rows
  local rows
  rows=$(cat)
  printf '%s행, md5 %s' "$(printf '%s' "$rows" | grep -c . || true)" "$(printf '%s' "$rows" | md5 -q)"
}

src_tables=$(q "$SOURCE_DB_URL" "$TABLES_SQL")
[ -n "$src_tables" ] || fail "원본에서 public 테이블을 하나도 찾지 못했습니다. SOURCE_DB_URL 을 확인하세요."
TABLES=()
while IFS= read -r t; do TABLES+=("$t"); done <<< "$src_tables"
TABLES+=("auth.users" "auth.identities")

if $SOURCE_ONLY; then
  echo "행 수"
  for t in "${TABLES[@]}"; do
    printf "  %-30s %10s\n" "$t" "$(count "$SOURCE_DB_URL" "$t")"
  done
  echo
  echo "구조"
  q "$SOURCE_DB_URL" "$STRUCTURE_SQL" | while read -r k v; do printf "  %-30s %10s\n" "$k" "$v"; done
  echo
  echo "권한 지문      $(q "$SOURCE_DB_URL" "$GRANTS_SQL" | fingerprint)"
  echo "기본 권한 지문 $(q "$SOURCE_DB_URL" "$DEFAULT_ACL_SQL" | fingerprint)"
  exit 0
fi

mismatch=0

echo "1) 행 수"
printf "  %-30s %10s %10s  %s\n" "테이블" "원본" "대상" "결과"
for t in "${TABLES[@]}"; do
  s=$(count "$SOURCE_DB_URL" "$t")
  d=$(count "$TARGET_DB_URL" "$t")
  if [ "$s" = "$d" ] && [ "$s" != "ERR" ]; then
    mark="일치"
  else
    mark="어긋남"
    mismatch=$((mismatch + 1))
  fi
  printf "  %-30s %10s %10s  %s\n" "$t" "$s" "$d" "$mark"
done

echo
echo "2) 구조"
src_struct=$(q "$SOURCE_DB_URL" "$STRUCTURE_SQL")
dst_struct=$(q "$TARGET_DB_URL" "$STRUCTURE_SQL")
while read -r k s; do
  d=$(printf '%s\n' "$dst_struct" | awk -v k="$k" '$1 == k { print $2 }')
  if [ "$s" = "$d" ]; then mark="일치"; else mark="어긋남"; mismatch=$((mismatch + 1)); fi
  printf "  %-30s %10s %10s  %s\n" "$k" "$s" "${d:-없음}" "$mark"
done <<< "$src_struct"

# $1=라벨 $2=sql — 줄 단위로 비교하고, 다르면 어느 줄이 다른지 보여준다.
compare_rows() {
  local src dst
  src=$(q "$SOURCE_DB_URL" "$2")
  dst=$(q "$TARGET_DB_URL" "$2")
  echo
  echo "$1"
  echo "  원본 $(printf '%s' "$src" | fingerprint)"
  echo "  대상 $(printf '%s' "$dst" | fingerprint)"
  if [ "$src" = "$dst" ]; then
    echo "  일치"
  else
    mismatch=$((mismatch + 1))
    echo "  어긋남 (- 원본에만, + 대상에만)"
    diff <(printf '%s\n' "$src") <(printf '%s\n' "$dst") | grep -E '^[<>] .' | sed 's/^</    -/; s/^>/    +/' || true
  fi
}

compare_rows "3) 권한" "$GRANTS_SQL"
compare_rows "4) 기본 권한" "$DEFAULT_ACL_SQL"

echo
if [ "$mismatch" -eq 0 ]; then
  echo "모두 일치합니다. 다음 단계로 진행하세요."
else
  echo "$mismatch 개 항목이 어긋납니다. 환경변수를 교체하지 말고 원인을 먼저 확인하세요."
  exit 1
fi
