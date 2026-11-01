import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/v26.sql", "utf8");

describe("setlist position functions", () => {
  it.each([
    ["insert_setlist_item", "UUID, UUID, TEXT, UUID, TEXT, TEXT, INT"],
    ["reorder_setlist_items", "UUID, UUID[]"],
  ])("only service_role can run %s", (fn, args) => {
    expect(sql).toContain(`REVOKE ALL ON FUNCTION ${fn}(${args}) FROM PUBLIC, anon, authenticated;`);
    expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${fn}(${args}) TO service_role;`);
  });

  it("serializes inserts and reorders of one playlist on the same lock", () => {
    const locks = sql.match(/pg_advisory_xact_lock\([^;]*\);/g) ?? [];
    expect(locks).toHaveLength(2);
    expect(new Set(locks).size).toBe(1);
  });

  it("refuses a null playlist in both functions, so no row lands outside a playlist", () => {
    expect(sql.match(/IF p_playlist_id IS NULL THEN\s+RAISE EXCEPTION 'playlist_not_found';/g) ?? []).toHaveLength(2);
  });
});
