#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): refuse edits to files whose content Claude must not author by hand.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
const rel = relative(root, file);

const onMain = (path) =>
  ["origin/main", "main"].some((ref) => {
    try {
      execFileSync("git", ["cat-file", "-e", `${ref}:${path}`], { cwd: root, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });

/** Each guard returns why the edit is refused, or nothing. */
const guards = [
  // A migration that reached main has run on production.
  (path) =>
    /^supabase\/migrations\/v\d+\.sql$/.test(path) &&
    onMain(path) &&
    `${path} 는 main 에 들어가 운영 DB 에 적용된 마이그레이션이다. 고치지 말고 npm run db:new 로 다음 번호 파일을 만들어 ` +
      "바꿀 내용을 거기에 적는다(.claude/skills/db-migration).",
  // The DS ratchet only shrinks; eslint writes this file, and only to prune it.
  (path) =>
    path === "eslint-suppressions.json" &&
    "eslint-suppressions.json 은 DS 래칫 baseline 이라 손으로 고치지 않는다. 새로 걸린 컨트롤은 src/components/ui 의 primitive 로 " +
      "그리고(npx eslint 메시지가 무엇으로 그릴지 알려 준다), 고쳐서 남은 항목은 npx eslint --prune-suppressions 로 줄인다. " +
      "늘린 항목은 node scripts/ds-inventory.mjs --check-baseline 이 main 과 비교해 잡는다.",
];

const reason = guards.map((guard) => guard(rel)).find(Boolean);
if (!reason) process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  }),
);
