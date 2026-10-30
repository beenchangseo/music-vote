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
if (run.status === 1) {
  process.stderr.write(`eslint 가 ${rel} 에서 에러를 찾았다. 고친 뒤 계속한다.\n${run.stdout}${run.stderr}`);
  process.exit(2);
}
