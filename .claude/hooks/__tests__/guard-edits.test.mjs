import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hook = join(import.meta.dirname, "..", "guard-edits.mjs");
const root = join(import.meta.dirname, "..", "..", "..");

// An exported GIT_DIR (as under `git rebase --exec`) would win over the hook's cwd; CLAUDE_PROJECT_DIR would win over `root`.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "CLAUDE_PROJECT_DIR"));

function decide(tool_name, path) {
  const run = spawnSync("node", [hook], {
    input: JSON.stringify({ tool_name, tool_input: { file_path: join(root, path) }, cwd: root }),
    encoding: "utf8",
    env,
  });
  return run.stdout ? JSON.parse(run.stdout).hookSpecificOutput : { permissionDecision: "allow" };
}

describe("guard-edits", () => {
  it.each(["Edit", "Write", "MultiEdit"])("denies %s of the DS ratchet baseline and points at the prune", (tool) => {
    const out = decide(tool, "eslint-suppressions.json");
    expect(out.permissionDecision).toBe("deny");
    expect(out.permissionDecisionReason).toContain("npx eslint --prune-suppressions");
  });

  it("denies a migration that reached main", () => {
    expect(decide("Edit", "supabase/migrations/v01.sql").permissionDecision).toBe("deny");
  });

  it.each(["supabase/migrations/v999.sql", "scripts/ds-inventory.mjs", "src/eslint-suppressions.json"])("allows %s", (path) => {
    expect(decide("Edit", path).permissionDecision).toBe("allow");
  });
});
