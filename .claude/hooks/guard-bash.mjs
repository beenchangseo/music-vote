#!/usr/bin/env node
// PreToolUse(Bash): stops shell commands that have already hurt this project.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const { tool_input: { command = "" } = {}, cwd } = JSON.parse(readFileSync(0, "utf8"));

// Look only at what the shell runs. Heredoc bodies and quoted prose (commit messages, echo text) are data,
// but a quoted single word ("main") is still an argument.
const code = command
  .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, "<<HEREDOC")
  .replace(/'([\w./:@+-]*)'|"([\w./:@+-]*)"/g, (_, single, double) => single ?? double)
  .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
// Start of a command, after optional VAR=value prefixes.
const AT_COMMAND = String.raw`(?:^|[;&|(\n]\s*)(?:\w+=\S*\s+)*`;
const at = (pattern, flags = "") => new RegExp(AT_COMMAND + pattern, flags);

function decide(permissionDecision, permissionDecisionReason) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason } }));
  process.exit(0);
}

if (at(String.raw`echo\b[^|\n]*\|\s*(?:npx\s+)?vercel\s+env\s+add\b`).test(code)) {
  decide(
    "deny",
    "echo 로 넣으면 값 끝에 줄바꿈이 붙는다(NEXT_PUBLIC_SUPABASE_ANON_KEY 가 그렇게 들어가 Realtime 이 죽었다). " +
      "printf '%s' \"$VAL\" | vercel env add NAME production --force --yes 로 다시 실행할 것.",
  );
}

const currentBranch = () => {
  try {
    return execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const pushArgs = [...code.matchAll(at(String.raw`git(?:\s+-[Cc]\s+\S+)*\s+push\b([^;&|\n]*)`, "g"))].map((m) => m[1]);
const pushesMain = pushArgs.some((args) => {
  const positional = args.trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
  if (positional.length < 2) return currentBranch() === "main";
  return positional.slice(1).some(
    (ref) => /^(\+|.*:)?(refs\/heads\/)?main$/.test(ref) || (/^\+?(HEAD|@)$/.test(ref) && currentBranch() === "main"),
  );
});
const changesProduction =
  pushesMain ||
  at(String.raw`gh\s+pr\s+merge\b`).test(code) ||
  at(String.raw`(?:npx\s+)?vercel\b[^;&|\n]*\s(?:--prod\b|--target[=\s]+production\b)`).test(code) ||
  at(String.raw`(?:npx\s+)?vercel\s+(?:promote|rollback)\b`).test(code);

if (changesProduction) {
  decide(
    "ask",
    "프로덕션을 바꾸는 명령이다(main push · PR 머지 · vercel --prod/promote/rollback). 새 마이그레이션이 있으면 운영 DB 에 " +
      "먼저 적용했는지, npm run check 와 e2e 게이트를 통과했는지 확인한 뒤 진행한다(.claude/skills/prod-deploy).",
  );
}
