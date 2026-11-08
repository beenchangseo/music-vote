import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/v28.sql", "utf8");
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("songs INSERT through the publishable key", () => {
  // addSong checks the deadline and the archive before it writes; a session token sent straight to PostgREST would skip both (#88).
  it("takes INSERT away from anon and authenticated", () => {
    expect(statements).toContain("REVOKE INSERT ON songs FROM anon, authenticated;");
  });

  it("states the service_role INSERT that addSong now writes with, rather than leaning on the default grant", () => {
    expect(statements).toContain("GRANT INSERT ON songs TO service_role;");
  });

  it("gives no song write back to the publishable key", () => {
    expect(statements).not.toMatch(/GRANT[^;]*ON\s+songs[^;]*TO[^;]*\b(anon|authenticated)\b/i);
  });
});
