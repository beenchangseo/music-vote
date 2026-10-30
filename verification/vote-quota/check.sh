#!/usr/bin/env bash
# Model-checks Plypick's vote promises (VoteQuota.tla) with TLC and compares each
# result with expected.txt. How to read the result: .claude/skills/verify-vote-quota/SKILL.md
#
#   verification/vote-quota/check.sh            every scenario and property
#   verification/vote-quota/check.sh save       one scenario
#
# Exit 0: drift guard clean and every result matches expected.txt.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"

TLA_VERSION=1.7.4
TLA_SHA256=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
jar="${TLA2TOOLS:-$root/.tools/tla/tla2tools-$TLA_VERSION.jar}"

find_java() {
  local j
  for j in "${JAVA:-}" "$(command -v java || true)" /opt/homebrew/opt/openjdk/bin/java /usr/local/opt/openjdk/bin/java; do
    # macOS ships a /usr/bin/java stub that fails without a JDK, so test each one.
    if [ -n "$j" ] && "$j" -version >/dev/null 2>&1; then echo "$j"; return; fi
  done
  echo "Java 11+ not found. Install one (macOS: brew install openjdk) or set JAVA=/path/to/java." >&2
  exit 2
}
java="$(find_java)"

if [ ! -f "$jar" ]; then
  mkdir -p "$(dirname "$jar")"
  echo "downloading tla2tools $TLA_VERSION ..." >&2
  curl -fsSL -o "$jar.part" "https://github.com/tlaplus/tlaplus/releases/download/v$TLA_VERSION/tla2tools.jar"
  mv "$jar.part" "$jar"
fi
if ! echo "$TLA_SHA256  $jar" | shasum -a 256 -c - >/dev/null 2>&1; then
  echo "checksum mismatch: $jar is not tla2tools $TLA_VERSION" >&2
  exit 2
fi

drift_status=0
node "$here/drift.mjs" || drift_status=$?

scenarios=("${@:-voters save configure setLimit applyAll}")
read -r -a scenarios <<< "${scenarios[*]}"
props=(QuotaHolds FreeOneVotePerSong VotesMatchMode)

out="$here/out"
rm -rf "$out"
mkdir -p "$out"

host_ops() { if [ "$1" = voters ]; then echo '{}'; else echo "{\"$1\"}"; fi; }

results="$out/results.txt"
: > "$results"
for s in "${scenarios[@]}"; do
  for p in "${props[@]}"; do
    cfg="$out/$s-$p.cfg"
    cat > "$cfg" <<EOF
SPECIFICATION Spec
CONSTANTS
  Voters = {"v1", "v2"}
  HostOps = $(host_ops "$s")
  Songs = {"s1", "s2"}
  LimitValues = {0, 1, 2}
  DefaultValues = {1, 2}
  NONE = NONE
INVARIANT TypeOK
INVARIANT $p
EOF
    log="$out/$s-$p.out"
    (cd "$here" && "$java" -XX:+UseParallelGC -cp "$jar" tlc2.TLC \
      -workers auto -metadir "$out/states-$s-$p" -config "$cfg" VoteQuota.tla > "$log" 2>&1) || true
    if grep -q "Invariant $p is violated" "$log"; then r=fail
    elif grep -q "Model checking completed. No error has been found." "$log"; then r=pass
    elif grep -q "Deadlock reached" "$log"; then r=deadlock
    else r=error
    fi
    states="$(grep -oE '[0-9,]+ distinct states found' "$log" | tail -1 | cut -d' ' -f1 || true)"
    printf '%-10s %-20s %-8s %s\n' "$s" "$p" "$r" "${states:-?} states" | tee -a "$results"
  done
done

status=0
while read -r s p r _; do
  want="$(awk -v s="$s" -v p="$p" '$1 == s && $2 == p { print $3 }' "$here/expected.txt")"
  if [ "$r" != "$want" ]; then
    echo "MISMATCH $s $p: got $r, expected ${want:-nothing}  (log: ${out#"$root"/}/$s-$p.out)"
    status=1
  fi
done < "$results"

if [ "$drift_status" -ne 0 ]; then
  echo "DRIFT: the covered SQL changed since the last sync; re-check the model against it (see the skill)."
  status=1
fi
[ "$status" -eq 0 ] && echo "OK: every result matches expected.txt"
exit "$status"
