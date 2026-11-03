import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "@/actions/__tests__/fake-supabase";

const db = vi.hoisted(() => ({
  respond: ((): FakeResult => ({ data: [] })) as (op: FakeOp) => FakeResult,
  ops: [] as FakeOp[],
  user: null as { id: string; nickname: string; avatarUrl: null } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    const fake = createFakeClient((op) => db.respond(op));
    db.ops = fake.ops;
    return fake.client;
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => db.user }));

import { GET } from "../route";

const PLAYLIST_ID = "22222222-2222-4222-8222-222222222222";

function get(playlistId = PLAYLIST_ID) {
  return GET(new Request(`https://plypick.kr/api/playlist/${playlistId}/comments`), { params: Promise.resolve({ playlistId }) });
}

/** Answers like PostgREST: every column for "*", otherwise only the columns asked for. */
function project(rows: Record<string, unknown>[], op: FakeOp): FakeResult {
  if (!op.columns || op.columns === "*") return { data: rows };
  const columns = op.columns.split(",").map((column) => column.trim());
  return { data: rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))) };
}

const DRUM = "5e0d1c2b-aaaa-4aaa-8aaa-000000000001";
const BASS = "5e0d1c2b-bbbb-4bbb-8bbb-000000000002";

beforeEach(() => {
  db.ops = [];
  db.user = null;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/playlist/[playlistId]/comments", () => {
  const rows = [
    { id: "c1", song_id: "s1", nickname: "드럼", content: "템포 좋아요", created_at: "t1", updated_at: "t1", user_id: DRUM },
    { id: "c2", song_id: "s2", nickname: "베이스", content: "키 내려요", created_at: "t2", updated_at: "t2", user_id: BASS },
  ];

  it("answers the comments on the playlist's songs oldest first, marking the viewer's own", async () => {
    db.user = { id: BASS, nickname: "베이스", avatarUrl: null };
    db.respond = (op) => (op.table === "songs" ? { data: [{ id: "s1" }, { id: "s2" }] } : project(rows, op));

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual([
      { id: "c1", song_id: "s1", nickname: "드럼", content: "템포 좋아요", created_at: "t1", updated_at: "t1", isMine: false },
      { id: "c2", song_id: "s2", nickname: "베이스", content: "키 내려요", created_at: "t2", updated_at: "t2", isMine: true },
    ]);
    expect(db.ops[0]).toMatchObject({ table: "songs", filters: { playlist_id: PLAYLIST_ID } });
    expect(db.ops[1]).toMatchObject({ table: "comments", filters: { song_id: ["s1", "s2"] } });
    expect(db.ops[1].orders).toEqual([{ column: "created_at", ascending: true }]);
  });

  it.each([
    ["a logged-out visitor", null],
    ["a commenter", DRUM],
  ])("sends %s no account id (ADR 0011)", async (_viewer, userId) => {
    db.user = userId ? { id: userId, nickname: "드럼", avatarUrl: null } : null;
    db.respond = (op) => (op.table === "songs" ? { data: [{ id: "s1" }, { id: "s2" }] } : project(rows, op));

    const body = await (await get()).text();

    expect(body).not.toContain(DRUM);
    expect(body).not.toContain(BASS);
    expect(body).not.toMatch(/user_?id/i);
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

  it.each(["not-a-uuid", "../setlist", ""])("answers 404 for %j without reading or logging, so a bad link cannot fill the logs", async (playlistId) => {
    const response = await get(playlistId);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(db.ops).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });
});
