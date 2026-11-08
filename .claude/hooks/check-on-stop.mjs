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

// A tree is checked once: a pass is not re-run, and a failure is reported once, not on every later turn
// (the owner may leave work in progress broken on purpose).
const cache = join(root, "node_modules/.cache/claude-check-seen");
if (existsSync(cache) && readFileSync(cache, "utf8") === fingerprint) process.exit(0);

const run = spawnSync("npm", ["run", "check", "--silent"], { cwd: root, encoding: "utf8" });
mkdirSync(dirname(cache), { recursive: true });
writeFileSync(cache, fingerprint);
if (run.status === 0) process.exit(0);

const tail = `${run.stdout}${run.stderr}`.trim().split("\n").slice(-40).join("\n");
console.log(
  JSON.stringify({
    decision: "block",
    reason:
      "커밋하지 않은 코드 변경이 npm run check(typecheck · lint · test)를 통과하지 못했다. 이번 작업에서 네가 만든 변경이 " +
      `원인이면 고친다. 사용자가 만들어 둔 변경이 원인이면 고치지 말고 실패를 그대로 보고한다.\n${tail}`,
  }),
);
