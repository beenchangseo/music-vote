import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hook = join(import.meta.dirname, "..", "guard-bash.mjs");

function decision(command, cwd = process.cwd()) {
  const run = spawnSync("node", [hook], { input: JSON.stringify({ tool_input: { command }, cwd }), encoding: "utf8" });
  return run.stdout ? JSON.parse(run.stdout).hookSpecificOutput.permissionDecision : "allow";
}

describe("guard-bash", () => {
  it.each([
    ["deny", 'echo "sb_publishable_x" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production'],
    ["deny", "cd /tmp && echo $VAL | npx vercel env add FOO production"],
    ["allow", `printf '%s' "$VAL" | vercel env add FOO production --force --yes`],
    ["ask", "git push origin main"],
    ["ask", "git push --force origin main"],
    ["ask", "git push origin HEAD:main"],
    ["allow", "git push -u origin chore/project-cleanup"],
    ["allow", "git push origin main-fix"],
    ["ask", 'git push origin "main"'],
    ["ask", "git push origin refs/heads/main"],
    ["ask", "git push origin +main"],
    ["ask", "git -C /tmp/x push origin main"],
    ["ask", "FOO=1 git push origin main"],
    ["allow", "git push origin feature/main-menu"],
    ["ask", "gh pr merge 12 --merge"],
    ["allow", "gh pr view 12"],
    ["ask", "vercel --prod"],
    ["ask", "npx vercel deploy --prod --yes"],
    ["ask", "vercel promote https://plypick-abc.vercel.app"],
    ["ask", "vercel rollback"],
    ["ask", "vercel deploy --target=production"],
    ["ask", "vercel deploy --target production"],
    ["allow", "vercel deploy"],
  ])("%s: %s", (want, command) => {
    expect(decision(command)).toBe(want);
  });

  it("reads commit messages as data, not commands", () => {
    expect(decision('git commit -m "echo x | vercel env add 막고 vercel --prod 는 묻는다, git push origin main"')).toBe("allow");
    expect(decision("git commit -F - <<'EOF'\n`echo … | vercel env add` 거부\ngit push origin main\nEOF\ngit log -1")).toBe("allow");
    expect(decision("git commit -F - <<'EOF'\nmsg\nEOF\ngit push origin main")).toBe("ask");
  });

  it("asks for a bare push only when the current branch is main", () => {
    const repo = mkdtempSync(join(tmpdir(), "guard-bash-"));
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    expect(decision("git push", repo)).toBe("ask");
    expect(decision("git push -u origin feature-x", repo)).toBe("allow");
    expect(decision("git push origin HEAD", repo)).toBe("ask");
    expect(decision("git push origin @", repo)).toBe("ask");
    execFileSync("git", ["-C", repo, "switch", "-q", "-c", "feature-x"]);
    expect(decision("git push", repo)).toBe("allow");
    expect(decision("git push origin HEAD", repo)).toBe("allow");
  });
});
