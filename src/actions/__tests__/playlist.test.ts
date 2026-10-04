import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VotingMode } from "@/lib/types";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

const state = vi.hoisted(() => ({
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  session: null as unknown as ReturnType<typeof createFakeClient>,
  getCurrentUser: vi.fn(),
  nanoid: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => state.admin.client,
  createServerSupabaseClient: async () => state.session.client,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: state.getCurrentUser }));
vi.mock("@/lib/playlist-admin", () => ({ assertPlaylistAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("nanoid", () => ({ nanoid: state.nanoid }));

import { createPlaylist, getMyPlaylists } from "../playlist";

const USER = { id: "user-1", nickname: "드럼", avatarUrl: null };

const ok = (data: unknown = null): FakeResult => ({ data, error: null });

/** Admin responder for createPlaylist: playlists insert results in order, then side tables. */
function adminResponder(opts: {
  inserts: FakeResult[];
  adminTokenError?: boolean;
  memberError?: boolean;
}) {
  let insertCount = 0;
  return (op: FakeOp): FakeResult => {
    if (op.table === "playlists" && op.action === "insert") {
      return opts.inserts[insertCount++] ?? ok();
    }
    if (op.table === "playlist_admin") {
      return opts.adminTokenError ? { error: { message: "boom" } } : ok();
    }
    if (op.table === "playlist_members") {
      return opts.memberError ? { error: { message: "boom" } } : ok();
    }
    return ok();
  };
}

const opsFor = (ops: FakeOp[], table: string, action: FakeOp["action"]) =>
  ops.filter((op) => op.table === table && op.action === action);

describe("createPlaylist", () => {
  beforeEach(() => {
    state.admin = createFakeClient();
    state.session = createFakeClient();
    state.getCurrentUser.mockReset().mockResolvedValue(USER);
    let shareCodes = 0;
    let tokens = 0;
    state.nanoid
      .mockReset()
      .mockImplementation((size: number) => (size === 8 ? `code-${++shareCodes}` : `token-${++tokens}`));
  });

  it("rejects an empty or over-long title before touching the database", async () => {
    await expect(createPlaylist("")).rejects.toThrow("합주방 제목은 1~100자여야 합니다.");
    await expect(createPlaylist("가".repeat(101))).rejects.toThrow("합주방 제목은 1~100자여야 합니다.");
    expect(state.admin.ops).toEqual([]);
  });

  it("rejects an unknown voting mode or vote limit before inserting", async () => {
    await expect(createPlaylist("합주", undefined, undefined, "secret" as VotingMode)).rejects.toThrow(
      "올바른 투표 방식을 선택해주세요.",
    );
    await expect(createPlaylist("합주", undefined, undefined, "allocated", 0)).rejects.toThrow(
      "기본 투표권은 1~99개여야 합니다.",
    );
    expect(state.admin.ops).toEqual([]);
  });

  it("refuses to create a room without a logged-in session user", async () => {
    state.getCurrentUser.mockResolvedValue(null);

    await expect(createPlaylist("합주")).rejects.toThrow("로그인이 필요합니다.");
    expect(state.admin.ops).toEqual([]);
  });

  it("inserts through the admin client with the session user as creator", async () => {
    state.admin = createFakeClient(
      adminResponder({ inserts: [ok({ id: "pl-1", share_code: "code-1" })] }),
    );

    await expect(createPlaylist("주말 합주", undefined, 12, "allocated", 5)).resolves.toEqual({
      id: "pl-1",
      shareCode: "code-1",
      adminToken: "token-1",
    });

    const [insert] = opsFor(state.admin.ops, "playlists", "insert");
    expect(insert.row).toMatchObject({
      title: "주말 합주",
      share_code: "code-1",
      creator_user_id: USER.id,
      creator_nickname: USER.nickname,
      voting_mode: "allocated",
      default_vote_limit: 5,
      setlist_count: 12,
    });
    expect(insert.returning).toBe(true);
    expect(opsFor(state.admin.ops, "playlist_admin", "insert")[0].row).toEqual({
      playlist_id: "pl-1",
      admin_token: "token-1",
    });
    expect(opsFor(state.admin.ops, "playlist_members", "insert")[0].row).toMatchObject({
      playlist_id: "pl-1",
      user_id: USER.id,
      vote_limit: 5,
    });
    // The public insert policy is gone after v18; nothing may go through the session client.
    expect(state.session.ops).toEqual([]);
  });

  it("retries with a fresh share code when the first one collides (23505)", async () => {
    state.admin = createFakeClient(
      adminResponder({
        inserts: [
          { data: null, error: { code: "23505", message: "duplicate key" } },
          ok({ id: "pl-2", share_code: "code-2" }),
        ],
      }),
    );

    await expect(createPlaylist("합주")).resolves.toEqual({
      id: "pl-2",
      shareCode: "code-2",
      adminToken: "token-2",
    });

    const inserts = opsFor(state.admin.ops, "playlists", "insert");
    expect(inserts.map((op) => op.row?.share_code)).toEqual(["code-1", "code-2"]);
    expect(opsFor(state.admin.ops, "playlists", "delete")).toEqual([]);
  });

  it("does not retry on errors other than a share code collision", async () => {
    state.admin = createFakeClient(
      adminResponder({ inserts: [{ data: null, error: { code: "42501", message: "denied" } }] }),
    );

    await expect(createPlaylist("합주")).rejects.toThrow("합주방 생성에 실패했습니다.");
    expect(opsFor(state.admin.ops, "playlists", "insert")).toHaveLength(1);
  });

  it("gives up after three share code collisions", async () => {
    const collision = { data: null, error: { code: "23505", message: "duplicate key" } };
    state.admin = createFakeClient(adminResponder({ inserts: [collision, collision, collision] }));

    await expect(createPlaylist("합주")).rejects.toThrow("share_code 생성에 실패했습니다.");
    expect(opsFor(state.admin.ops, "playlists", "insert")).toHaveLength(3);
  });

  it("deletes the new room when storing the admin token fails", async () => {
    state.admin = createFakeClient(
      adminResponder({ inserts: [ok({ id: "pl-1", share_code: "code-1" })], adminTokenError: true }),
    );

    await expect(createPlaylist("합주")).rejects.toThrow("합주방 생성에 실패했습니다.");

    const deletes = opsFor(state.admin.ops, "playlists", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].filters).toEqual({ id: "pl-1" });
    expect(opsFor(state.admin.ops, "playlist_members", "insert")).toEqual([]);
  });

  it("deletes the new room when registering the creator as a member fails", async () => {
    state.admin = createFakeClient(
      adminResponder({ inserts: [ok({ id: "pl-1", share_code: "code-1" })], memberError: true }),
    );

    await expect(createPlaylist("합주")).rejects.toThrow("합주방 생성에 실패했습니다.");

    const deletes = opsFor(state.admin.ops, "playlists", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].filters).toEqual({ id: "pl-1" });
  });
});

describe("getMyPlaylists", () => {
  beforeEach(() => {
    state.admin = createFakeClient();
    state.session = createFakeClient();
    state.getCurrentUser.mockReset();
  });

  it("returns an empty list without querying when nobody is logged in", async () => {
    state.getCurrentUser.mockResolvedValue(null);

    await expect(getMyPlaylists()).resolves.toEqual([]);
    expect(state.admin.ops).toEqual([]);
  });

  const room = (id: string, createdAt: string) => ({
    id,
    share_code: `code-${id}`,
    title: `방 ${id}`,
    created_at: createdAt,
  });
  const entry = (id: string, createdAt: string, teamName: string | null = null) => ({
    id,
    shareCode: `code-${id}`,
    title: `방 ${id}`,
    createdAt,
    teamName,
  });

  /** Responds per set: created (playlists), joined (playlist_members), team (team_members). */
  function sets(results: { created?: FakeResult; joined?: FakeResult; teams?: FakeResult }) {
    return (op: FakeOp): FakeResult => {
      if (op.table === "playlists") return results.created ?? ok([]);
      if (op.table === "playlist_members") return results.joined ?? ok([]);
      if (op.table === "team_members") return results.teams ?? ok([]);
      return ok();
    };
  }

  it("reads the three sets for the session user in one round trip through the admin client", async () => {
    state.getCurrentUser.mockResolvedValue(USER);
    state.admin = createFakeClient(sets({ created: ok([room("pl-1", "2026-10-01")]) }));

    await expect(getMyPlaylists()).resolves.toEqual([entry("pl-1", "2026-10-01")]);

    expect(state.admin.ops.map((op) => [op.table, op.action, op.filters])).toEqual([
      ["playlists", "select", { creator_user_id: USER.id }],
      ["playlist_members", "select", { user_id: USER.id }],
      ["team_members", "select", { user_id: USER.id }],
    ]);
    // Nested FK selects, not a second query per set (eng D5).
    expect(state.admin.ops[1].columns).toContain("playlists(");
    expect(state.admin.ops[2].columns).toContain("teams(name, playlists(");
    // The session client cannot select playlists after v18.
    expect(state.session.ops).toEqual([]);
  });

  it("merges created, joined and band rooms, removes duplicates and sorts newest first", async () => {
    state.getCurrentUser.mockResolvedValue(USER);
    state.admin = createFakeClient(
      sets({
        created: ok([room("mine", "2026-10-01"), room("shared", "2026-09-01")]),
        joined: ok([{ playlists: room("joined", "2026-10-03") }, { playlists: room("shared", "2026-09-01") }]),
        teams: ok([
          {
            teams: {
              name: "일코해제",
              playlists: [room("band-new", "2026-10-05"), room("shared", "2026-09-01")],
            },
          },
        ]),
      }),
    );

    await expect(getMyPlaylists()).resolves.toEqual([
      entry("band-new", "2026-10-05", "일코해제"),
      entry("joined", "2026-10-03"),
      entry("mine", "2026-10-01"),
      // In several sets: listed once, with the band caption from the team set.
      entry("shared", "2026-09-01", "일코해제"),
    ]);
  });

  it.each([
    ["null (room link gone)", { playlists: null }],
    ["an object (many-to-one)", { playlists: room("a", "2026-10-02") }],
    ["an array", { playlists: [room("a", "2026-10-02")] }],
  ])("flattens a joined room returned as %s", async (_label, row) => {
    state.getCurrentUser.mockResolvedValue(USER);
    state.admin = createFakeClient(sets({ joined: ok([row]) }));

    const expected = row.playlists ? [entry("a", "2026-10-02")] : [];
    await expect(getMyPlaylists()).resolves.toEqual(expected);
  });

  it.each([
    ["teams null", { teams: null }],
    ["teams as an array with rooms as an object", { teams: [{ name: "밴드", playlists: room("t", "2026-10-02") }] }],
    ["teams as an object with no rooms", { teams: { name: "밴드", playlists: null } }],
  ])("flattens band rooms returned with %s", async (_label, row) => {
    state.getCurrentUser.mockResolvedValue(USER);
    state.admin = createFakeClient(sets({ teams: ok([row]) }));

    const teams = row.teams === null ? [] : Array.isArray(row.teams) ? row.teams : [row.teams];
    const expected = teams.some((team) => team.playlists) ? [entry("t", "2026-10-02", "밴드")] : [];
    await expect(getMyPlaylists()).resolves.toEqual(expected);
  });

  it("keeps the other sets and logs when one query fails", async () => {
    state.getCurrentUser.mockResolvedValue(USER);
    state.admin = createFakeClient(
      sets({
        created: ok([room("mine", "2026-10-01")]),
        joined: { data: null, error: { code: "57014", message: "timeout" } },
        teams: ok([{ teams: { name: "일코해제", playlists: [room("band", "2026-10-02")] } }]),
      }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getMyPlaylists()).resolves.toEqual([
      entry("band", "2026-10-02", "일코해제"),
      entry("mine", "2026-10-01"),
    ]);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("joined"),
      expect.objectContaining({ userId: USER.id, code: "57014" }),
    );
    log.mockRestore();
  });

  it("after leaving or being removed from a band, only the band set disappears", async () => {
    state.getCurrentUser.mockResolvedValue(USER);
    // Before: the room comes from both the joined set and the band set.
    state.admin = createFakeClient(
      sets({
        joined: ok([{ playlists: room("entered", "2026-10-01") }]),
        teams: ok([{ teams: { name: "일코해제", playlists: [room("entered", "2026-10-01"), room("never-opened", "2026-10-02")] } }]),
      }),
    );
    await expect(getMyPlaylists()).resolves.toEqual([
      entry("never-opened", "2026-10-02", "일코해제"),
      entry("entered", "2026-10-01", "일코해제"),
    ]);

    // After: no team_members row. The room I entered stays (without the band caption).
    state.admin = createFakeClient(sets({ joined: ok([{ playlists: room("entered", "2026-10-01") }]) }));
    await expect(getMyPlaylists()).resolves.toEqual([entry("entered", "2026-10-01")]);
  });
});
