import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/v27.sql", "utf8");
const locks = (text: string) => text.match(/pg_advisory_xact_lock\([^;]*\);/g) ?? [];

describe("confirm_setlist", () => {
  it("only service_role can run it", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION confirm_setlist(UUID, UUID[]) FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION confirm_setlist(UUID, UUID[]) TO service_role;");
  });

  it("queues behind the same per-playlist lock as inserting and reordering blocks", () => {
    const v26 = readFileSync("supabase/migrations/v26.sql", "utf8");
    expect(locks(sql)).toEqual([locks(v26)[0]]);
  });

  it("refuses a null playlist, so no row lands outside a playlist", () => {
    expect(sql).toMatch(/IF p_playlist_id IS NULL THEN\s+RAISE EXCEPTION 'playlist_not_found';/);
  });
});
