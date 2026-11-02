import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "@/actions/__tests__/fake-supabase";

const db = vi.hoisted(() => ({ respond: ((): FakeResult => ({ data: [] })) as (op: FakeOp) => FakeResult, ops: [] as FakeOp[] }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    const fake = createFakeClient((op) => db.respond(op));
    db.ops = fake.ops;
    return fake.client;
  },
}));

import { GET } from "../route";

const PLAYLIST_ID = "22222222-2222-4222-8222-222222222222";

function get(playlistId = PLAYLIST_ID) {
  return GET(new Request(`https://plypick.kr/api/playlist/${playlistId}/setlist`), { params: Promise.resolve({ playlistId }) });
}

beforeEach(() => {
  db.ops = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/playlist/[playlistId]/setlist", () => {
  it("answers the playlist's setlist, breaking position ties the way the position functions do", async () => {
    const rows = [{ id: "a", position: 0 }, { id: "b", position: 1 }];
    db.respond = () => ({ data: rows, error: null });

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(rows);
    expect(db.ops[0]).toMatchObject({ table: "setlist_items", filters: { playlist_id: PLAYLIST_ID } });
    expect(db.ops[0].orders).toEqual([
      { column: "position", ascending: true },
      { column: "created_at", ascending: true },
      { column: "id", ascending: true },
    ]);
  });

  it("answers 500 instead of an empty setlist when the read fails, so the screen keeps its list and tries again", async () => {
    db.respond = () => ({ data: null, error: { code: "57014" } });

    const response = await get();

    expect(response.status).toBe(500);
  });

  it.each(["not-a-uuid", "../setlist", ""])("answers 404 for %j without reading or logging, so a bad link cannot fill the logs", async (playlistId) => {
    const response = await get(playlistId);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(db.ops).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });
});
