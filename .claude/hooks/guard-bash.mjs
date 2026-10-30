#!/usr/bin/env node
// PreToolUse(Bash): stops shell commands that have already hurt this project.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const { tool_input: { command = "" } = {}, cwd } = JSON.parse(readFileSync(0, "utf8"));

// Look only at what the shell runs: heredoc bodies and quoted strings (commit messages, echo text) are data.
const code = command
  .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, "<<HEREDOC")
  .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
const AT_COMMAND = String.raw`(?:^|[;&|(\n]\s*)`;

function decide(permissionDecision, permissionDecisionReason) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason } }));
  process.exit(0);
}

if (new RegExp(String.raw`${AT_COMMAND}echo\b[^|\n]*\|\s*(?:npx\s+)?vercel\s+env\s+add\b`).test(code)) {
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

const pushArgs = [...code.matchAll(new RegExp(String.raw`${AT_COMMAND}git\s+push\b([^;&|\n]*)`, "g"))].map((m) => m[1]);
const pushesMain = pushArgs.some((args) => {
  const positional = args.trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
  if (positional.length >= 2) return positional.slice(1).some((ref) => /(^|:)main$/.test(ref));
  return currentBranch() === "main";
});
const prodDeploy = new RegExp(String.raw`${AT_COMMAND}(?:npx\s+)?vercel\b[^;&|\n]*\s--prod\b`).test(code);

if (pushesMain || prodDeploy) {
  decide(
    "ask",
    "main push 와 vercel --prod 는 곧 프로덕션 배포다. 새 마이그레이션이 있으면 운영 DB 에 먼저 적용했는지, " +
      "npm run check 와 e2e 게이트를 통과했는지 확인한 뒤 진행한다(.claude/skills/prod-deploy).",
  );
}
