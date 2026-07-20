import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repeated vote migration", () => {
  it("removes the legacy nickname constraint only for logged-in votes", () => {
    const sql = readFileSync("supabase-migration-v13.sql", "utf8");

    expect(sql).toContain("DROP CONSTRAINT IF EXISTS votes_song_id_nickname_key");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_votes_song_legacy_nickname[\s\S]*WHERE user_id IS NULL/);
  });
});
