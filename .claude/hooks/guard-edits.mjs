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
  // The eslint CLI reads this file from the repo root on its own and passes every error it lists, whatever the rule.
  (path) =>
    path === "eslint-suppressions.json" &&
    "eslint 에는 봐주는 baseline 이 없다. eslint-suppressions.json 이 있으면 eslint CLI 가 그 파일을 읽어 적힌 규칙의 에러를 " +
      "그대로 넘긴다. ds/* 뿐 아니라 익명 모드를 지키는 postgres_changes 금지(no-restricted-syntax)도 지나간다. 걸린 곳은 " +
      "eslint 메시지가 알려 주는 src/components/ui 부품이나 맞는 토큰으로 고친다.",
];

const reason = guards.map((guard) => guard(rel)).find(Boolean);
if (!reason) process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  }),
);
