#!/usr/bin/env bash
# 두 Supabase 프로젝트의 행 수를 대조한다. 읽기만 한다.
#
#   export SOURCE_DB_URL='postgresql://...'
#   export TARGET_DB_URL='postgresql://...'
#   bash scripts/compare-supabase-projects.sh
#
#   bash scripts/compare-supabase-projects.sh --source-only   # 전환 전 현황 기록용
#
# auth.users 가 어긋나면 방장 권한과 투표 기록이 끊어진다. 반드시 일치해야 한다.

set -euo pipefail

PSQL="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"
SOURCE_ONLY=false
[ "${1:-}" = "--source-only" ] && SOURCE_ONLY=true

TABLES=(
  "public.playlists"
  "public.playlist_admin"
  "public.playlist_members"
  "public.songs"
  "public.votes"
  "public.comments"
  "public.setlist_items"
  "public.song_versions"
  "auth.users"
  "auth.identities"
)

fail() { echo "  실패: $*" >&2; exit 1; }

[ -n "${SOURCE_DB_URL:-}" ] || fail "SOURCE_DB_URL 이 없습니다."
$SOURCE_ONLY || [ -n "${TARGET_DB_URL:-}" ] || fail "TARGET_DB_URL 이 없습니다."
[ -x "$PSQL" ] || fail "psql 을 찾을 수 없습니다: $PSQL"

count() { # $1=db_url $2=table
  "$PSQL" -At -d "$1" -c "SELECT count(*) FROM $2" 2>/dev/null || echo "ERR"
}

if $SOURCE_ONLY; then
  printf "%-26s %10s\n" "테이블" "원본"
  for t in "${TABLES[@]}"; do
    printf "%-26s %10s\n" "$t" "$(count "$SOURCE_DB_URL" "$t")"
  done
  exit 0
fi

printf "%-26s %10s %10s  %s\n" "테이블" "원본" "대상" "결과"
mismatch=0
for t in "${TABLES[@]}"; do
  s=$(count "$SOURCE_DB_URL" "$t")
  d=$(count "$TARGET_DB_URL" "$t")
  if [ "$s" = "$d" ] && [ "$s" != "ERR" ]; then
    mark="일치"
  else
    mark="어긋남"
    mismatch=$((mismatch + 1))
  fi
  printf "%-26s %10s %10s  %s\n" "$t" "$s" "$d" "$mark"
done

echo
if [ "$mismatch" -eq 0 ]; then
  echo "모두 일치합니다. 다음 단계로 진행하세요."
else
  echo "$mismatch 개 테이블이 어긋납니다. 환경변수를 교체하지 말고 원인을 먼저 확인하세요."
  exit 1
fi
