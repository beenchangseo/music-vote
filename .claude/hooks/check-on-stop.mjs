#!/usr/bin/env node
// Stop: before Claude ends a turn with uncommitted code changes, run `npm run check`.
// A passing working tree is remembered by fingerprint so an unchanged tree is not re-checked.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const CODE = ["*.ts", "*.tsx", "*.mts", "*.mjs", "*.sql", "package.json", "eslint.config.mjs", "tsconfig.json"];

const diff = git("diff", "HEAD", "--", ...CODE);
const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...CODE).split("\n").filter(Boolean);
if (!diff && untracked.length === 0) process.exit(0);

const hash = createHash("sha256").update(diff);
for (const f of untracked) hash.update(f).update(readFileSync(join(root, f)));
const fingerprint = hash.digest("hex");

const cache = join(root, "node_modules/.cache/claude-check-pass");
if (existsSync(cache) && readFileSync(cache, "utf8") === fingerprint) process.exit(0);

const run = spawnSync("npm", ["run", "check", "--silent"], { cwd: root, encoding: "utf8" });
if (run.status === 0) {
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, fingerprint);
  process.exit(0);
}

const tail = `${run.stdout}${run.stderr}`.trim().split("\n").slice(-40).join("\n");
console.log(
  JSON.stringify({
    decision: "block",
    reason: `커밋하지 않은 코드 변경이 npm run check(typecheck · lint · test)를 통과하지 못했다. 고치거나, 고치지 못하면 사용자에게 실패를 그대로 보고한다.\n${tail}`,
  }),
);
