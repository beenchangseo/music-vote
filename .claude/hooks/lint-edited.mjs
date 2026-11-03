#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): lint the file that was just written and hand errors back to Claude.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const file = input.tool_input?.file_path ?? input.tool_response?.filePath;
if (!file) process.exit(0);

const rel = relative(root, file);
if (rel.startsWith("..") || rel.startsWith(".claude/worktrees/") || !/\.(ts|tsx|mts|mjs)$/.test(rel)) process.exit(0);

const run = spawnSync("npx", ["eslint", "--no-warn-ignored", rel], { cwd: root, encoding: "utf8" });
const output = `${run.stdout}${run.stderr}`;
if (run.status === 1) {
  process.stderr.write(`eslint 가 ${rel} 에서 에러를 찾았다. 고친 뒤 계속한다.\n${output}`);
  process.exit(2);
}
// Exit 2 is also a crash; only the leftover-suppressions case names the prune flag.
if (run.status === 2 && output.includes("--prune-suppressions")) {
  process.stderr.write(
    `${rel} 에서 eslint-suppressions.json 이 봐주던 위반이 사라졌다. npx eslint --prune-suppressions 로 baseline 을 줄여 같이 커밋한다.\n`,
  );
  process.exit(2);
}
