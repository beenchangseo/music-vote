import { beforeEach, describe, expect, it, vi } from "vitest";
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

function get() {
  return GET(new Request(`https://plypick.kr/api/playlist/${PLAYLIST_ID}/comments`), { params: Promise.resolve({ playlistId: PLAYLIST_ID }) });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/playlist/[playlistId]/comments", () => {
  it("answers the comments on the playlist's songs oldest first, without asking for the account id", async () => {
    const comments = [{ id: "c1", song_id: "s1", nickname: "드럼", content: "템포 좋아요", created_at: "t", updated_at: "t" }];
    db.respond = (op) => (op.table === "songs" ? { data: [{ id: "s1" }, { id: "s2" }] } : { data: comments });

    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(comments);
    expect(db.ops[0]).toMatchObject({ table: "songs", filters: { playlist_id: PLAYLIST_ID } });
    expect(db.ops[1]).toMatchObject({ table: "comments", filters: { song_id: ["s1", "s2"] } });
    expect(db.ops[1].orders).toEqual([{ column: "created_at", ascending: true }]);
    expect(db.ops[1].columns).not.toMatch(/\*|user_id/);
  });

  it("answers an empty list without reading comments when the playlist has no songs", async () => {
    db.respond = () => ({ data: [] });

    const response = await get();

    expect(await response.json()).toEqual([]);
    expect(db.ops.map((op) => op.table)).toEqual(["songs"]);
  });

  it.each([
    ["songs", (op: FakeOp) => (op.table === "songs" ? { data: null, error: { code: "57014" } } : { data: [] })],
    ["comments", (op: FakeOp) => (op.table === "songs" ? { data: [{ id: "s1" }] } : { data: null, error: { code: "57014" } })],
  ])("answers 500 when the %s read fails, so the screen keeps its comments and tries again", async (_table, respond) => {
    db.respond = respond;

    const response = await get();

    expect(response.status).toBe(500);
  });
});
