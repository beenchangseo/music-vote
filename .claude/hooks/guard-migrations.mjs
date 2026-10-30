#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): a migration that reached main has run on production; never rewrite it.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const file = input.tool_input?.file_path;
if (!file) process.exit(0);

const rel = relative(root, file);
if (!/^supabase\/migrations\/v\d+\.sql$/.test(rel)) process.exit(0);

const onMain = ["origin/main", "main"].some((ref) => {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}:${rel}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});
if (!onMain) process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `${rel} 는 main 에 들어가 운영 DB 에 적용된 마이그레이션이다. 고치지 말고 npm run db:new 로 다음 번호 파일을 만들어 ` +
        "바꿀 내용을 거기에 적는다(.claude/skills/db-migration).",
    },
  }),
);
