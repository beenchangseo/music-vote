import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARCHIVED_PLAYLIST_MESSAGE } from "@/lib/playlist-archive";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

const state = vi.hoisted(() => ({
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  session: null as unknown as ReturnType<typeof createFakeClient>,
  getCurrentUser: vi.fn(),
  nanoid: vi.fn(),
  assertPlaylistWritable: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => state.admin.client,
  createServerSupabaseClient: async () => state.session.client,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: state.getCurrentUser }));
vi.mock("@/lib/playlist-access", () => ({ assertPlaylistWritable: state.assertPlaylistWritable }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
vi.mock("nanoid", () => ({ nanoid: state.nanoid }));

import {
  attachPlaylistToTeam,
  createBandPlaylist,
  createTeam,
  createTeamFromPlaylist,
  getAttachablePlaylists,
  getMyTeams,
  getTeamHome,
  getTeamInvite,
  joinTeam,
  leaveTeam,
  regenerateInviteCode,
  removeTeamMember,
  updateTeamNextShow,
} from "../team";

const ME = { id: "user-me", nickname: "보컬", avatarUrl: null };
const OTHER = "user-other";
const TEAM = "11111111-1111-4111-8111-111111111111";
const ROOM = "room-1";
const CODE = "aB3_x-9Zq0";

const ok = (data: unknown = null): FakeResult => ({ data, error: null });
const dbError = (code = "XX000"): FakeResult => ({ data: null, error: { code, message: "boom" } });
const collision = dbError("23505");

type Handler = FakeResult | FakeResult[] | ((op: FakeOp) => FakeResult);

/** Answers each op by "table:action". An array is consumed in order (last one repeats). */
function router(handlers: Record<string, Handler>) {
  const seen: Record<string, number> = {};
  return (op: FakeOp): FakeResult => {
    const key = `${op.table}:${op.action}`;
    const handler = handlers[key];
    if (handler === undefined) return ok(null);
    if (typeof handler === "function") return handler(op);
    if (Array.isArray(handler)) {
      const index = seen[key] ?? 0;
      seen[key] = index + 1;
      return handler[Math.min(index, handler.length - 1)];
    }
    return handler;
  };
}

const opsFor = (table: string, action: FakeOp["action"]) =>
  state.admin.ops.filter((op) => op.table === table && op.action === action);
const indexOf = (table: string, action: FakeOp["action"]) =>
  state.admin.ops.findIndex((op) => op.table === table && op.action === action);
const writes = () => state.admin.ops.filter((op) => op.action !== "select");

beforeEach(() => {
  state.admin = createFakeClient();
  state.session = createFakeClient();
  state.getCurrentUser.mockReset().mockResolvedValue(ME);
  state.assertPlaylistWritable.mockReset().mockResolvedValue(undefined);
  state.revalidatePath.mockReset();
  let invites = 0;
  let shares = 0;
  let tokens = 0;
  state.nanoid.mockReset().mockImplementation((size: number) => {
    if (size === 10) return `invite-${++invites}`;
    if (size === 8) return `share-${++shares}`;
    return `token-${++tokens}`;
  });
});

afterEach(() => {
  // Team tables are closed to the public key; nothing may go through the session client.
  expect(state.session.ops).toEqual([]);
  vi.restoreAllMocks();
});

// ============================================================
// createTeamFromPlaylist
// ============================================================

describe("createTeamFromPlaylist", () => {
  const myRoom = { id: ROOM, share_code: "room-code", creator_user_id: ME.id, team_id: null };
  const roomMembers = [
    { user_id: ME.id, display_name: "보컬(방)" },
    { user_id: "user-guitar", display_name: "기타" },
    { user_id: "user-drum", display_name: "드럼" },
  ];

  function happyPath(overrides: Record<string, Handler> = {}) {
    return router({
      "playlists:select": ok(myRoom),
      "playlist_members:select": ok(roomMembers),
      "teams:insert": ok({ id: TEAM }),
      "team_members:insert": ok(),
      "playlists:update": ok([{ id: ROOM }]),
      ...overrides,
    });
  }

  it("requires a logged-in user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "not_logged_in",
    });
    expect(state.admin.ops).toEqual([]);
  });

  it.each([
    ["51 characters", "가".repeat(51)],
    ["only spaces", "   "],
    ["empty", ""],
  ])("rejects a band name of %s before touching the database", async (_label, name) => {
    await expect(createTeamFromPlaylist(ROOM, name)).resolves.toEqual({
      success: false,
      reason: "invalid_name",
    });
    expect(state.admin.ops).toEqual([]);
  });

  it("creates the team, copies every room participant and links the room as 'promote'", async () => {
    state.admin = createFakeClient(happyPath());

    await expect(createTeamFromPlaylist(ROOM, "  일코해제  ")).resolves.toEqual({
      success: true,
      teamId: TEAM,
      name: "일코해제",
      inviteCode: "invite-1",
      memberCount: 3,
    });

    expect(state.assertPlaylistWritable).toHaveBeenCalledWith(ROOM);
    const [teamInsert] = opsFor("teams", "insert");
    expect(teamInsert.row).toEqual({
      name: "일코해제",
      invite_code: "invite-1",
      created_by: ME.id,
      created_via: "promote",
    });
    expect(teamInsert.returning).toBe(true);

    const [membersInsert] = opsFor("team_members", "insert");
    expect(membersInsert.rows).toEqual([
      { team_id: TEAM, user_id: ME.id, display_name: ME.nickname, role: "owner" },
      { team_id: TEAM, user_id: "user-guitar", display_name: "기타", role: "member" },
      { team_id: TEAM, user_id: "user-drum", display_name: "드럼", role: "member" },
    ]);

    const [link] = opsFor("playlists", "update");
    expect(link.row).toEqual({ team_id: TEAM, team_linked_via: "promote" });
    expect(link.filters).toEqual({ id: ROOM, "is:team_id": null });
    expect(link.returning).toBe(true);

    // Order is the contract: team → members → link.
    expect(indexOf("teams", "insert")).toBeLessThan(indexOf("team_members", "insert"));
    expect(indexOf("team_members", "insert")).toBeLessThan(indexOf("playlists", "update"));
    expect(opsFor("teams", "delete")).toEqual([]);
    expect(state.revalidatePath).toHaveBeenCalledWith("/playlist/room-code");
  });

  it("accepts a 50-character name", async () => {
    state.admin = createFakeClient(happyPath());
    const name = "가".repeat(50);
    await expect(createTeamFromPlaylist(ROOM, name)).resolves.toMatchObject({ success: true });
    expect(opsFor("teams", "insert")[0].row?.name).toBe(name);
  });

  it("refuses an archived room", async () => {
    state.assertPlaylistWritable.mockRejectedValue(new Error(ARCHIVED_PLAYLIST_MESSAGE));
    state.admin = createFakeClient(happyPath({ "playlists:select": ok({ ...myRoom, creator_user_id: null }) }));

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "archived",
    });
    expect(writes()).toEqual([]);
  });

  it("reports a missing room", async () => {
    state.assertPlaylistWritable.mockRejectedValue(new Error("플레이리스트를 찾을 수 없습니다."));
    state.admin = createFakeClient(happyPath({ "playlists:select": ok(null) }));

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "playlist_not_found",
    });
    expect(writes()).toEqual([]);
  });

  it("refuses when the caller is not the room creator", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:select": ok({ ...myRoom, creator_user_id: OTHER }) }));

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "not_room_owner",
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a room that already belongs to a band", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:select": ok({ ...myRoom, team_id: "team-x" }) }));

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "already_in_team",
    });
    expect(writes()).toEqual([]);
  });

  it("retries with a fresh invite code when the first one collides (23505)", async () => {
    state.admin = createFakeClient(happyPath({ "teams:insert": [collision, ok({ id: TEAM })] }));

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toMatchObject({ success: true });
    expect(opsFor("teams", "insert").map((op) => op.row?.invite_code)).toEqual(["invite-1", "invite-2"]);
  });

  it("gives up after three invite code collisions without leaving anything behind", async () => {
    state.admin = createFakeClient(happyPath({ "teams:insert": collision }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "invite_code_conflict",
    });
    expect(opsFor("teams", "insert")).toHaveLength(3);
    expect(opsFor("team_members", "insert")).toEqual([]);
    expect(opsFor("playlists", "update")).toEqual([]);
  });

  it("deletes the new team when inserting the members fails", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:insert": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "write_failed",
    });
    const deletes = opsFor("teams", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].filters).toEqual({ id: TEAM });
    expect(opsFor("playlists", "update")).toEqual([]);
  });

  it("deletes the new team when another tab linked the room first (conditional update matched 0 rows)", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:update": ok([]) }));

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "already_in_team",
    });
    expect(opsFor("teams", "delete")[0].filters).toEqual({ id: TEAM });
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes the new team when linking the room errors", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:update": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "write_failed",
    });
    expect(opsFor("teams", "delete")).toHaveLength(1);
  });

  it("logs the orphan team id when the rollback delete itself fails", async () => {
    state.admin = createFakeClient(
      happyPath({ "playlists:update": ok([]), "teams:delete": dbError() }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createTeamFromPlaylist(ROOM, "일코해제")).resolves.toEqual({
      success: false,
      reason: "already_in_team",
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("rollback delete failed"),
      expect.objectContaining({ teamId: TEAM }),
    );
    // Never log nicknames.
    expect(JSON.stringify(log.mock.calls)).not.toContain(ME.nickname);
  });
});

// ============================================================
// createTeam (홈의 빈 밴드)
// ============================================================

describe("createTeam", () => {
  function happyPath(overrides: Record<string, Handler> = {}) {
    return router({ "teams:insert": ok({ id: TEAM }), "team_members:insert": ok(), ...overrides });
  }

  it("requires a logged-in user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(createTeam("일코해제")).resolves.toEqual({ success: false, reason: "not_logged_in" });
    expect(state.admin.ops).toEqual([]);
  });

  it.each([
    ["51 characters", "가".repeat(51)],
    ["only spaces", "   "],
  ])("rejects a band name of %s before touching the database", async (_label, name) => {
    await expect(createTeam(name)).resolves.toEqual({ success: false, reason: "invalid_name" });
    expect(state.admin.ops).toEqual([]);
  });

  it("creates a band from home with the caller as its only member", async () => {
    state.admin = createFakeClient(happyPath());

    await expect(createTeam("  일코해제  ")).resolves.toEqual({ success: true, teamId: TEAM });

    const [teamInsert] = opsFor("teams", "insert");
    expect(teamInsert.row).toEqual({
      name: "일코해제",
      invite_code: "invite-1",
      created_by: ME.id,
      created_via: "home",
    });
    const [ownerInsert] = opsFor("team_members", "insert");
    expect(ownerInsert.row).toEqual({ team_id: TEAM, user_id: ME.id, display_name: ME.nickname, role: "owner" });
    expect(indexOf("teams", "insert")).toBeLessThan(indexOf("team_members", "insert"));
    // No room is touched: the band starts empty.
    expect(state.admin.ops.filter((op) => op.table === "playlists")).toEqual([]);
    expect(opsFor("teams", "delete")).toEqual([]);
  });

  it("accepts a 50-character name", async () => {
    state.admin = createFakeClient(happyPath());
    await expect(createTeam("가".repeat(50))).resolves.toMatchObject({ success: true });
  });

  it("retries with a fresh invite code when the first one collides (23505)", async () => {
    state.admin = createFakeClient(happyPath({ "teams:insert": [collision, ok({ id: TEAM })] }));
    await expect(createTeam("일코해제")).resolves.toMatchObject({ success: true });
    expect(opsFor("teams", "insert").map((op) => op.row?.invite_code)).toEqual(["invite-1", "invite-2"]);
  });

  it("deletes the new band when the owner row cannot be written", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:insert": dbError() }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createTeam("일코해제")).resolves.toEqual({ success: false, reason: "write_failed" });
    expect(opsFor("teams", "delete")[0].filters).toEqual({ id: TEAM });
    expect(JSON.stringify(log.mock.calls)).not.toContain(ME.nickname);
  });

  it("reports a failed team insert without writing members", async () => {
    state.admin = createFakeClient(happyPath({ "teams:insert": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createTeam("일코해제")).resolves.toEqual({ success: false, reason: "write_failed" });
    expect(opsFor("team_members", "insert")).toEqual([]);
  });
});

// ============================================================
// attachPlaylistToTeam
// ============================================================

describe("attachPlaylistToTeam", () => {
  const myRoom = { id: ROOM, share_code: "room-code", creator_user_id: ME.id, team_id: null };

  function happyPath(overrides: Record<string, Handler> = {}) {
    return router({
      "playlists:select": ok(myRoom),
      "team_members:select": ok({ role: "member" }),
      "playlists:update": ok([{ id: ROOM }]),
      ...overrides,
    });
  }

  it("links my room to my band as 'attach'", async () => {
    state.admin = createFakeClient(happyPath());

    await expect(attachPlaylistToTeam(ROOM, TEAM)).resolves.toEqual({ success: true, teamId: TEAM });

    expect(state.assertPlaylistWritable).toHaveBeenCalledWith(ROOM);
    const [link] = opsFor("playlists", "update");
    expect(link.row).toEqual({ team_id: TEAM, team_linked_via: "attach" });
    expect(link.filters).toEqual({ id: ROOM, "is:team_id": null });
    expect(link.returning).toBe(true);
    // Room participants do not become band members.
    expect(opsFor("team_members", "insert")).toEqual([]);
    expect(state.revalidatePath).toHaveBeenCalledWith("/playlist/room-code");
    expect(state.revalidatePath).toHaveBeenCalledWith(`/band/${TEAM}`);
  });

  it("refuses a room created by someone else", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:select": ok({ ...myRoom, creator_user_id: OTHER }) }));
    await expect(attachPlaylistToTeam(ROOM, TEAM)).resolves.toEqual({ success: false, reason: "not_room_owner" });
    expect(writes()).toEqual([]);
  });

  it("refuses when I am not a member of that band", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:select": ok(null) }));
    await expect(attachPlaylistToTeam(ROOM, TEAM)).resolves.toEqual({ success: false, reason: "not_member" });
    expect(writes()).toEqual([]);
  });

  it("refuses an archived room", async () => {
    state.assertPlaylistWritable.mockRejectedValue(new Error(ARCHIVED_PLAYLIST_MESSAGE));
    state.admin = createFakeClient(happyPath());
    await expect(attachPlaylistToTeam(ROOM, TEAM)).resolves.toEqual({ success: false, reason: "archived" });
    expect(writes()).toEqual([]);
  });

  it("refuses a room that is already in a band", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:select": ok({ ...myRoom, team_id: "team-x" }) }));
    await expect(attachPlaylistToTeam(ROOM, TEAM)).resolves.toEqual({ success: false, reason: "already_in_team" });
    expect(writes()).toEqual([]);
  });

  it("treats a conditional update that matched 0 rows as already in a band", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:update": ok([]) }));
    await expect(attachPlaylistToTeam(ROOM, TEAM)).resolves.toEqual({ success: false, reason: "already_in_team" });
  });

  it("does not query with a malformed band id", async () => {
    await expect(attachPlaylistToTeam(ROOM, "not-a-uuid")).resolves.toEqual({
      success: false,
      reason: "team_not_found",
    });
    expect(state.admin.ops).toEqual([]);
  });
});

// ============================================================
// joinTeam
// ============================================================

describe("joinTeam", () => {
  it("does not query with a malformed invite code", async () => {
    await expect(joinTeam("../../etc")).resolves.toEqual({ success: false, reason: "invite_not_found" });
    expect(state.admin.ops).toEqual([]);
  });

  it("requires a logged-in user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(joinTeam(CODE)).resolves.toEqual({ success: false, reason: "not_logged_in" });
    expect(state.admin.ops).toEqual([]);
  });

  it("reports an unknown or rotated code", async () => {
    state.admin = createFakeClient(router({ "teams:select": ok(null) }));
    await expect(joinTeam(CODE)).resolves.toEqual({ success: false, reason: "invite_not_found" });
    expect(writes()).toEqual([]);
  });

  it("adds me as a member with my Kakao nickname", async () => {
    state.admin = createFakeClient(router({ "teams:select": ok({ id: TEAM }) }));

    await expect(joinTeam(CODE)).resolves.toEqual({ success: true, teamId: TEAM, alreadyMember: false });
    expect(opsFor("teams", "select")[0].filters).toEqual({ invite_code: CODE });
    expect(opsFor("team_members", "insert")[0].row).toEqual({
      team_id: TEAM,
      user_id: ME.id,
      display_name: ME.nickname,
      role: "member",
    });
  });

  it("is idempotent: joining twice succeeds and changes nothing (ON CONFLICT DO NOTHING)", async () => {
    state.admin = createFakeClient(router({ "teams:select": ok({ id: TEAM }), "team_members:insert": collision }));

    await expect(joinTeam(CODE)).resolves.toEqual({ success: true, teamId: TEAM, alreadyMember: true });
    // No upsert/update that could overwrite an owner's role.
    expect(opsFor("team_members", "update")).toEqual([]);
  });

  it("returns a reason for other insert failures", async () => {
    state.admin = createFakeClient(router({ "teams:select": ok({ id: TEAM }), "team_members:insert": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(joinTeam(CODE)).resolves.toEqual({ success: false, reason: "write_failed" });
  });
});

// ============================================================
// getTeamInvite
// ============================================================

describe("getTeamInvite", () => {
  const team = { id: TEAM, name: "일코해제", next_show_at: "2026-10-16" };
  const members = [
    { user_id: "u-guitar", display_name: "기타", role: "member", joined_at: "2026-10-02T00:00:00+00:00" },
    { user_id: "u-bass", display_name: "베이스", role: "member", joined_at: "2026-10-01T00:00:00+00:00" },
    { user_id: "u-owner", display_name: "보컬", role: "owner", joined_at: "2026-10-03T00:00:00+00:00" },
    { user_id: "u-drum", display_name: "드럼", role: "member", joined_at: "2026-10-04T00:00:00+00:00" },
    { user_id: "u-keys", display_name: "건반", role: "member", joined_at: "2026-10-05T00:00:00+00:00" },
  ];

  it("does not query with a malformed code", async () => {
    await expect(getTeamInvite("short")).resolves.toBeNull();
    expect(state.admin.ops).toEqual([]);
  });

  it("returns null for an unknown or rotated code", async () => {
    state.admin = createFakeClient(router({ "teams:select": ok(null) }));
    await expect(getTeamInvite(CODE)).resolves.toBeNull();
  });

  it("shows a logged-out visitor only the name, count, first three names and show date", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    state.admin = createFakeClient(router({ "teams:select": ok(team), "team_members:select": ok(members) }));

    // toEqual: no rooms, no invite code, no user ids, no fourth name.
    await expect(getTeamInvite(CODE)).resolves.toEqual({
      status: "invite",
      loggedIn: false,
      name: "일코해제",
      memberCount: 5,
      previewNames: ["보컬", "베이스", "기타"],
      nextShowAt: "2026-10-16",
    });
    expect(opsFor("playlists", "select")).toEqual([]);
  });

  it("shows a logged-in non-member the same reduced view", async () => {
    state.admin = createFakeClient(router({ "teams:select": ok(team), "team_members:select": ok(members) }));
    await expect(getTeamInvite(CODE)).resolves.toMatchObject({ status: "invite", loggedIn: true });
  });

  it("tells a member to go to the band home", async () => {
    state.admin = createFakeClient(
      router({
        "teams:select": ok(team),
        "team_members:select": ok([...members, { user_id: ME.id, display_name: "나", role: "member", joined_at: null }]),
      }),
    );
    await expect(getTeamInvite(CODE)).resolves.toEqual({ status: "member", teamId: TEAM, name: "일코해제" });
  });

  it("throws on an unexpected lookup error (error page)", async () => {
    state.admin = createFakeClient(router({ "teams:select": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getTeamInvite(CODE)).rejects.toThrow();
  });
});

// ============================================================
// getTeamHome (+ E1 history)
// ============================================================

describe("getTeamHome", () => {
  const team = {
    id: TEAM,
    name: "일코해제",
    invite_code: CODE,
    next_show_at: "2026-10-16",
    created_at: "2026-10-04T00:00:00+00:00",
  };
  const members = [
    { user_id: OTHER, display_name: "기타", role: "member", joined_at: "2026-10-05T00:00:00+00:00" },
    { user_id: "u-owner", display_name: "드럼", role: "owner", joined_at: "2026-10-04T00:00:00+00:00" },
    { user_id: ME.id, display_name: "보컬", role: "member", joined_at: "2026-10-06T00:00:00+00:00" },
  ];
  const rooms = [
    {
      id: "room-new",
      share_code: "new",
      title: "11월 공연",
      created_at: "2026-10-20T00:00:00+00:00",
      setlist_confirmed: false,
      playlist_members: [{ count: 3 }],
    },
    { id: "room-old", share_code: "old", title: "10월 공연", created_at: "2026-09-01T00:00:00+00:00", setlist_confirmed: true, playlist_members: { count: 2 } },
    { id: "room-attached", share_code: "att", title: "예전 방", created_at: "2026-07-01T00:00:00+00:00", setlist_confirmed: null, playlist_members: null },
  ];
  const thumb = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  const items = [
    {
      playlist_id: "room-old",
      position: 2,
      item_type: "song",
      song_id: "s2",
      title_override: null,
      songs: { title: "Creep", artist: "Radiohead", youtube_video_id: "v2", thumbnail_url: thumb("v2") },
    },
    {
      playlist_id: "room-old",
      position: 0,
      item_type: "song",
      song_id: "s1",
      title_override: "오프닝",
      songs: { title: "Intro", artist: null, youtube_video_id: "v1", thumbnail_url: thumb("v1") },
    },
    { playlist_id: "room-old", position: 1, item_type: "interval", song_id: null, title_override: null, songs: null },
    { playlist_id: "room-old", position: 3, item_type: "song", song_id: null, title_override: null, songs: null },
    {
      playlist_id: "room-attached",
      position: 0,
      item_type: "song",
      song_id: "s9",
      title_override: null,
      songs: [{ title: "Yellow", artist: "Coldplay", youtube_video_id: null, thumbnail_url: null }],
    },
  ];
  // Every song in the rooms, newest first (covers and counts).
  const roomSongs = [
    { playlist_id: "room-new", thumbnail_url: thumb("n1") },
    { playlist_id: "room-old", thumbnail_url: thumb("o3") },
    { playlist_id: "room-old", thumbnail_url: thumb("v2") },
    { playlist_id: "room-old", thumbnail_url: null },
  ];

  function home(overrides: Record<string, Handler> = {}) {
    return router({
      "teams:select": ok(team),
      "team_members:select": ok(members),
      "playlists:select": ok(rooms),
      "setlist_items:select": ok(items),
      "songs:select": ok(roomSongs),
      ...overrides,
    });
  }

  it("does not query with a malformed id", async () => {
    await expect(getTeamHome(CODE)).resolves.toBeNull();
    expect(state.admin.ops).toEqual([]);
  });

  it("returns null for an unknown band", async () => {
    state.admin = createFakeClient(home({ "teams:select": ok(null) }));
    await expect(getTeamHome(TEAM)).resolves.toBeNull();
  });

  it("shows a logged-out visitor only the band name", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    state.admin = createFakeClient(home());

    await expect(getTeamHome(TEAM)).resolves.toEqual({
      access: "guest",
      loggedIn: false,
      team: { id: TEAM, name: "일코해제" },
    });
    expect(opsFor("setlist_items", "select")).toEqual([]);
  });

  it("shows a logged-in non-member only the band name", async () => {
    state.admin = createFakeClient(home({ "team_members:select": ok(members.filter((m) => m.user_id !== ME.id)) }));
    await expect(getTeamHome(TEAM)).resolves.toEqual({
      access: "guest",
      loggedIn: true,
      team: { id: TEAM, name: "일코해제" },
    });
  });

  it("gives a member the rooms, the setlist history, the members and the invite code", async () => {
    state.admin = createFakeClient(home());

    const view = await getTeamHome(TEAM);
    expect(view).toEqual({
      access: "member",
      myRole: "member",
      team: {
        id: TEAM,
        name: "일코해제",
        inviteCode: CODE,
        nextShowAt: "2026-10-16",
        createdAt: "2026-10-04T00:00:00+00:00",
      },
      members: [
        // owner first, then join order; user ids only for the owner's view
        { userId: null, displayName: "드럼", role: "owner", joinedAt: "2026-10-04T00:00:00+00:00", isMe: false },
        { userId: null, displayName: "기타", role: "member", joinedAt: "2026-10-05T00:00:00+00:00", isMe: false },
        { userId: null, displayName: "보컬", role: "member", joinedAt: "2026-10-06T00:00:00+00:00", isMe: true },
      ],
      rooms: [
        {
          id: "room-new",
          shareCode: "new",
          title: "11월 공연",
          createdAt: "2026-10-20T00:00:00+00:00",
          setlistConfirmed: false,
          setlist: [],
          songCount: 1,
          coverThumbs: [thumb("n1")],
          participantCount: 3,
        },
        {
          id: "room-old",
          shareCode: "old",
          title: "10월 공연",
          createdAt: "2026-09-01T00:00:00+00:00",
          setlistConfirmed: true,
          // interval and deleted song (song_id NULL) dropped, position order, title override wins
          setlist: [
            { songId: "s1", title: "오프닝", artist: null, position: 0, videoId: "v1", thumbnailUrl: thumb("v1") },
            { songId: "s2", title: "Creep", artist: "Radiohead", position: 2, videoId: "v2", thumbnailUrl: thumb("v2") },
          ],
          songCount: 3,
          // setlist order first, then the newest songs; the same picture once
          coverThumbs: [thumb("v1"), thumb("v2"), thumb("o3")],
          participantCount: 2,
        },
        {
          id: "room-attached",
          shareCode: "att",
          title: "예전 방",
          createdAt: "2026-07-01T00:00:00+00:00",
          setlistConfirmed: false,
          setlist: [{ songId: "s9", title: "Yellow", artist: "Coldplay", position: 0, videoId: null, thumbnailUrl: null }],
          songCount: 0,
          coverThumbs: [],
          participantCount: 0,
        },
      ],
      // Not the owner: no attach entry, no count query.
      attachableCount: null,
    });
    expect(opsFor("playlists", "select")).toHaveLength(1);
    // Participants ride on the rooms query (DR9), no extra round trip.
    expect(opsFor("playlists", "select")[0].columns).toContain("playlist_members(count)");

    // One batched history query for all rooms, not one per room.
    const history = opsFor("setlist_items", "select");
    expect(history).toHaveLength(1);
    expect(history[0].filters).toEqual({
      playlist_id: ["room-new", "room-old", "room-attached"],
      item_type: "song",
    });
    expect(opsFor("playlists", "select")[0].filters).toEqual({ team_id: TEAM });
    const songs = opsFor("songs", "select");
    expect(songs).toHaveLength(1);
    expect(songs[0].filters).toEqual({ playlist_id: ["room-new", "room-old", "room-attached"] });
  });

  it("counts the owner's band-less playlists for the attach entry, beside the room reads (DR8)", async () => {
    const ownerMembers = members.map((member) => (member.user_id === ME.id ? { ...member, role: "owner" } : { ...member, role: "member" }));
    state.admin = createFakeClient(
      home({
        "team_members:select": ok(ownerMembers),
        "playlists:select": (op) => (op.filters.creator_user_id ? { data: null, error: null, count: 2 } : ok(rooms)),
      }),
    );
    const view = await getTeamHome(TEAM);
    expect(view).toMatchObject({ access: "member", myRole: "owner", attachableCount: 2 });
    const count = opsFor("playlists", "select").find((op) => op.filters.creator_user_id);
    expect(count?.filters).toEqual({ creator_user_id: ME.id, "is:team_id": null });
  });

  it("hides the attach entry when that count fails, without failing the band home", async () => {
    const ownerMembers = members.map((member) => (member.user_id === ME.id ? { ...member, role: "owner" } : { ...member, role: "member" }));
    state.admin = createFakeClient(
      home({
        "team_members:select": ok(ownerMembers),
        "playlists:select": (op) => (op.filters.creator_user_id ? dbError() : ok(rooms)),
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getTeamHome(TEAM)).resolves.toMatchObject({ attachableCount: null });
  });

  it("still shows the band when the cover lookup fails (setlist covers only, no counts)", async () => {
    state.admin = createFakeClient(home({ "songs:select": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await getTeamHome(TEAM);
    expect(view?.access).toBe("member");
    if (view?.access !== "member") return;
    expect(view.rooms.map((room) => [room.songCount, room.coverThumbs])).toEqual([
      [0, []],
      [0, [thumb("v1"), thumb("v2")]],
      [0, []],
    ]);
  });

  it("gives the owner the member user ids for removing someone", async () => {
    state.admin = createFakeClient(
      home({
        "team_members:select": ok(
          members.map((m) => (m.user_id === ME.id ? { ...m, role: "owner" } : m.role === "owner" ? { ...m, role: "member" } : m)),
        ),
      }),
    );
    const view = await getTeamHome(TEAM);
    expect(view?.access).toBe("member");
    if (view?.access !== "member") return;
    expect(view.myRole).toBe("owner");
    expect(view.members.map((m) => m.userId).sort()).toEqual([ME.id, OTHER, "u-owner"].sort());
  });

  it("skips the history query when the band has no rooms", async () => {
    state.admin = createFakeClient(home({ "playlists:select": ok([]) }));
    const view = await getTeamHome(TEAM);
    expect(view).toMatchObject({ access: "member", rooms: [] });
    expect(opsFor("setlist_items", "select")).toEqual([]);
  });

  it("throws on an unexpected lookup error (error.tsx)", async () => {
    state.admin = createFakeClient(home({ "playlists:select": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getTeamHome(TEAM)).rejects.toThrow();
  });
});

// ============================================================
// getMyTeams
// ============================================================

describe("getAttachablePlaylists (DR8)", () => {
  const rows = [
    {
      id: "pl-new",
      share_code: "new",
      title: "11월 합주",
      created_at: "2026-10-05T00:00:00Z",
      playlist_members: [{ count: 4 }],
      songs: [
        { thumbnail_url: "t-old", created_at: "2026-10-05T01:00:00Z" },
        { thumbnail_url: "t-new", created_at: "2026-10-05T02:00:00Z" },
      ],
    },
    { id: "pl-old", share_code: "old", title: "9월 합주", created_at: "2026-09-01T00:00:00Z", playlist_members: null, songs: null },
  ];

  it("requires a logged-in user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(getAttachablePlaylists(TEAM)).resolves.toEqual({ success: false, reason: "not_logged_in" });
    expect(state.admin.ops).toEqual([]);
  });

  it("refuses someone outside the band", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok(null), "playlists:select": ok(rows) }));
    await expect(getAttachablePlaylists(TEAM)).resolves.toEqual({ success: false, reason: "not_member" });
  });

  it("lists only my own playlists outside any band, newest first, with participants and covers", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok({ role: "owner" }), "playlists:select": ok(rows) }));
    await expect(getAttachablePlaylists(TEAM)).resolves.toEqual({
      success: true,
      playlists: [
        { id: "pl-new", shareCode: "new", title: "11월 합주", createdAt: "2026-10-05T00:00:00Z", participantCount: 4, coverThumbs: ["t-new", "t-old"] },
        { id: "pl-old", shareCode: "old", title: "9월 합주", createdAt: "2026-09-01T00:00:00Z", participantCount: 0, coverThumbs: [] },
      ],
    });
    const [query] = opsFor("playlists", "select");
    expect(query.filters).toEqual({ creator_user_id: ME.id, "is:team_id": null });
    expect(query.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("reports a failed read", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok({ role: "owner" }), "playlists:select": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getAttachablePlaylists(TEAM)).resolves.toEqual({ success: false, reason: "write_failed" });
  });
});

describe("getMyTeams", () => {
  it("returns an empty list without querying when nobody is logged in", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(getMyTeams()).resolves.toEqual({ teams: [], failed: false });
    expect(state.admin.ops).toEqual([]);
  });

  it("reads only my memberships and flattens the nested team rows, newest join first", async () => {
    state.admin = createFakeClient(
      router({
        "team_members:select": ok([
          {
            role: "owner",
            joined_at: "2026-10-01T00:00:00+00:00",
            teams: { id: "t-1", name: "일코해제", next_show_at: "2026-10-16", playlists: [{ count: 3 }] },
          },
          {
            role: "member",
            joined_at: "2026-10-03T00:00:00+00:00",
            teams: [{ id: "t-2", name: "산울림", next_show_at: null, playlists: { count: 1 } }],
          },
          { role: "member", joined_at: "2026-10-02T00:00:00+00:00", teams: { id: "t-3", name: "빈 밴드", next_show_at: null, playlists: null } },
          { role: "member", joined_at: "2026-10-04T00:00:00+00:00", teams: null },
        ]),
      }),
    );

    await expect(getMyTeams()).resolves.toEqual({
      teams: [
        { id: "t-2", name: "산울림", nextShowAt: null, role: "member", roomCount: 1 },
        { id: "t-3", name: "빈 밴드", nextShowAt: null, role: "member", roomCount: 0 },
        { id: "t-1", name: "일코해제", nextShowAt: "2026-10-16", role: "owner", roomCount: 3 },
      ],
      failed: false,
    });
    expect(state.admin.ops).toHaveLength(1);
    expect(state.admin.ops[0].filters).toEqual({ user_id: ME.id });
  });

  it("reports the failure with an empty list and logs when the query fails (eng E1)", async () => {
    state.admin = createFakeClient(router({ "team_members:select": dbError() }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getMyTeams()).resolves.toEqual({ teams: [], failed: true });
    expect(log).toHaveBeenCalled();
  });
});

// ============================================================
// createBandPlaylist
// ============================================================

describe("createBandPlaylist", () => {
  function happyPath(overrides: Record<string, Handler> = {}) {
    return router({
      "teams:select": ok({ id: TEAM }),
      "team_members:select": ok({ role: "member" }),
      "playlists:insert": ok({ id: "room-new", share_code: "share-1" }),
      ...overrides,
    });
  }

  it("requires a logged-in user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(createBandPlaylist(TEAM, "11월 공연")).resolves.toEqual({ success: false, reason: "not_logged_in" });
    expect(state.admin.ops).toEqual([]);
  });

  it.each([
    ["an empty title", ["", undefined, undefined, "free", 3], "invalid_title"],
    ["a 101-character title", ["가".repeat(101), undefined, undefined, "free", 3], "invalid_title"],
    ["an unknown voting mode", ["합주", undefined, undefined, "secret", 3], "invalid_voting_mode"],
    ["a zero vote limit", ["합주", undefined, undefined, "allocated", 0], "invalid_vote_limit"],
  ] as const)("returns a reason for %s before touching the database", async (_label, args, reason) => {
    const [title, deadline, count, mode, limit] = args;
    await expect(
      createBandPlaylist(TEAM, title, deadline, count, mode as "free", limit),
    ).resolves.toEqual({ success: false, reason });
    expect(state.admin.ops).toEqual([]);
  });

  it("does not query with a malformed band id", async () => {
    await expect(createBandPlaylist("garbage", "합주")).resolves.toEqual({ success: false, reason: "team_not_found" });
    expect(state.admin.ops).toEqual([]);
  });

  it("reports a band that does not exist", async () => {
    state.admin = createFakeClient(happyPath({ "teams:select": ok(null), "team_members:select": ok(null) }));
    await expect(createBandPlaylist(TEAM, "합주")).resolves.toEqual({ success: false, reason: "team_not_found" });
    expect(writes()).toEqual([]);
  });

  it("refuses a non-member without creating a room", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:select": ok(null) }));
    await expect(createBandPlaylist(TEAM, "합주")).resolves.toEqual({ success: false, reason: "not_member" });
    expect(writes()).toEqual([]);
  });

  it("creates the room in the band as 'band' with the session user as creator", async () => {
    state.admin = createFakeClient(happyPath());

    await expect(createBandPlaylist(TEAM, "11월 공연", undefined, 12, "allocated", 5)).resolves.toEqual({
      success: true,
      id: "room-new",
      shareCode: "share-1",
      adminToken: "token-1",
    });

    const [insert] = opsFor("playlists", "insert");
    expect(insert.row).toMatchObject({
      title: "11월 공연",
      share_code: "share-1",
      creator_user_id: ME.id,
      creator_nickname: ME.nickname,
      voting_mode: "allocated",
      default_vote_limit: 5,
      setlist_count: 12,
      team_id: TEAM,
      team_linked_via: "band",
    });
    expect(opsFor("playlist_admin", "insert")).toHaveLength(1);
    expect(opsFor("playlist_members", "insert")[0].row).toMatchObject({ playlist_id: "room-new", user_id: ME.id });
    // Membership is checked again after the insert.
    expect(opsFor("team_members", "select")).toHaveLength(2);
    expect(opsFor("playlists", "delete")).toEqual([]);
    expect(state.revalidatePath).toHaveBeenCalledWith(`/band/${TEAM}`);
  });

  it("deletes the new room when the post-insert membership check fails (removed meanwhile)", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:select": [ok({ role: "member" }), ok(null)] }));

    await expect(createBandPlaylist(TEAM, "합주")).resolves.toEqual({ success: false, reason: "not_member" });
    const deletes = opsFor("playlists", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].filters).toEqual({ id: "room-new" });
  });

  it("returns a reason when the room insert fails", async () => {
    state.admin = createFakeClient(happyPath({ "playlists:insert": dbError("42501") }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createBandPlaylist(TEAM, "합주")).resolves.toEqual({ success: false, reason: "write_failed" });
  });
});

// ============================================================
// updateTeamNextShow (E2)
// ============================================================

describe("updateTeamNextShow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-10-04 12:00 KST
    vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const member = (overrides: Record<string, Handler> = {}) =>
    router({ "team_members:select": ok({ role: "member" }), "teams:update": ok([{ id: TEAM }]), ...overrides });

  it("lets any member set the date", async () => {
    state.admin = createFakeClient(member());
    await expect(updateTeamNextShow(TEAM, "2026-10-16")).resolves.toEqual({ success: true, nextShowAt: "2026-10-16" });
    const [update] = opsFor("teams", "update");
    expect(update.row).toEqual({ next_show_at: "2026-10-16" });
    expect(update.filters).toEqual({ id: TEAM });
    expect(update.returning).toBe(true);
  });

  it("accepts today in KST", async () => {
    state.admin = createFakeClient(member());
    await expect(updateTeamNextShow(TEAM, "2026-10-04")).resolves.toMatchObject({ success: true });
  });

  it("clears the date with null", async () => {
    state.admin = createFakeClient(member());
    await expect(updateTeamNextShow(TEAM, null)).resolves.toEqual({ success: true, nextShowAt: null });
    expect(opsFor("teams", "update")[0].row).toEqual({ next_show_at: null });
  });

  it.each([
    ["a past date", "2026-10-03", "past_date"],
    ["a malformed date", "10/16", "invalid_date"],
    ["an impossible date", "2026-02-30", "invalid_date"],
  ])("rejects %s before touching the database", async (_label, value, reason) => {
    await expect(updateTeamNextShow(TEAM, value)).resolves.toEqual({ success: false, reason });
    expect(state.admin.ops).toEqual([]);
  });

  it("refuses a non-member", async () => {
    state.admin = createFakeClient(member({ "team_members:select": ok(null) }));
    await expect(updateTeamNextShow(TEAM, "2026-10-16")).resolves.toEqual({ success: false, reason: "not_member" });
    expect(writes()).toEqual([]);
  });

  it("treats an update that matched 0 rows as a failure", async () => {
    state.admin = createFakeClient(member({ "teams:update": ok([]) }));
    await expect(updateTeamNextShow(TEAM, "2026-10-16")).resolves.toEqual({ success: false, reason: "team_not_found" });
  });
});

// ============================================================
// regenerateInviteCode
// ============================================================

describe("regenerateInviteCode", () => {
  it("returns the new code to the owner", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok({ role: "owner" }), "teams:update": ok([{ id: TEAM }]) }));

    await expect(regenerateInviteCode(TEAM)).resolves.toEqual({ success: true, inviteCode: "invite-1" });
    const [update] = opsFor("teams", "update");
    expect(update.row).toEqual({ invite_code: "invite-1" });
    expect(update.filters).toEqual({ id: TEAM });
    expect(update.returning).toBe(true);
  });

  it.each([
    ["a plain member", ok({ role: "member" })],
    ["a non-member", ok(null)],
  ])("refuses %s", async (_label, membership) => {
    state.admin = createFakeClient(router({ "team_members:select": membership }));
    await expect(regenerateInviteCode(TEAM)).resolves.toEqual({ success: false, reason: "not_team_owner" });
    expect(writes()).toEqual([]);
  });

  it("retries with a fresh code when the first one collides (23505)", async () => {
    state.admin = createFakeClient(
      router({ "team_members:select": ok({ role: "owner" }), "teams:update": [collision, ok([{ id: TEAM }])] }),
    );
    await expect(regenerateInviteCode(TEAM)).resolves.toEqual({ success: true, inviteCode: "invite-2" });
    expect(opsFor("teams", "update").map((op) => op.row?.invite_code)).toEqual(["invite-1", "invite-2"]);
  });

  it("treats an update that matched 0 rows as a failure", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok({ role: "owner" }), "teams:update": ok([]) }));
    await expect(regenerateInviteCode(TEAM)).resolves.toEqual({ success: false, reason: "team_not_found" });
  });

  it("kills the old invite link: after rotating, the old code finds nothing and the new one works", async () => {
    // A tiny stateful stand-in for the teams row.
    const row = { id: TEAM, name: "일코해제", next_show_at: null as string | null, invite_code: CODE };
    state.getCurrentUser.mockResolvedValue(ME);
    state.admin = createFakeClient((op) => {
      if (op.table === "team_members" && op.action === "select") {
        // regenerate: my role; invite: member list without me
        return op.filters.user_id === ME.id
          ? ok({ role: "owner" })
          : ok([{ user_id: "u-x", display_name: "기타", role: "member", joined_at: null }]);
      }
      if (op.table === "teams" && op.action === "update") {
        row.invite_code = String(op.row?.invite_code);
        return ok([{ id: TEAM }]);
      }
      if (op.table === "teams" && op.action === "select") {
        return ok(op.filters.invite_code === row.invite_code ? row : null);
      }
      return ok(null);
    });

    // A real nanoid(10)-shaped code, so getTeamInvite's format check lets it through.
    state.nanoid.mockImplementation(() => "NEWcode_01");

    const rotated = await regenerateInviteCode(TEAM);
    expect(rotated).toEqual({ success: true, inviteCode: "NEWcode_01" });
    await expect(getTeamInvite(CODE)).resolves.toBeNull();
    await expect(getTeamInvite("NEWcode_01")).resolves.toMatchObject({ status: "invite", name: "일코해제" });
  });
});

// ============================================================
// removeTeamMember
// ============================================================

describe("removeTeamMember", () => {
  const ownerAndTarget = ok([
    { user_id: ME.id, role: "owner" },
    { user_id: OTHER, role: "member" },
  ]);

  function happyPath(overrides: Record<string, Handler> = {}) {
    return router({
      "team_members:select": ownerAndTarget,
      "teams:update": ok([{ id: TEAM }]),
      "team_members:delete": ok([{ user_id: OTHER }]),
      ...overrides,
    });
  }

  it("refuses to remove yourself", async () => {
    await expect(removeTeamMember(TEAM, ME.id)).resolves.toEqual({ success: false, reason: "cannot_remove_self" });
    expect(state.admin.ops).toEqual([]);
  });

  it("refuses a caller who is not the owner", async () => {
    state.admin = createFakeClient(
      happyPath({
        "team_members:select": ok([
          { user_id: ME.id, role: "member" },
          { user_id: OTHER, role: "member" },
        ]),
      }),
    );
    await expect(removeTeamMember(TEAM, OTHER)).resolves.toEqual({ success: false, reason: "not_team_owner" });
    expect(writes()).toEqual([]);
  });

  it("does not rotate the link when the target is not in the band", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:select": ok([{ user_id: ME.id, role: "owner" }]) }));
    await expect(removeTeamMember(TEAM, OTHER, true)).resolves.toEqual({ success: false, reason: "member_not_found" });
    expect(writes()).toEqual([]);
  });

  it("removes the member from the band only, keeping the invite link", async () => {
    state.admin = createFakeClient(happyPath());

    await expect(removeTeamMember(TEAM, OTHER)).resolves.toEqual({ success: true, inviteCode: null });
    const [remove] = opsFor("team_members", "delete");
    expect(remove.filters).toEqual({ team_id: TEAM, user_id: OTHER, role: "member" });
    expect(remove.returning).toBe(true);
    expect(opsFor("teams", "update")).toEqual([]);
    // Shallow coupling: room participation is untouched.
    expect(state.admin.ops.some((op) => op.table === "playlist_members")).toBe(false);
  });

  it("rotates the invite link BEFORE removing when asked, and returns the new code", async () => {
    state.admin = createFakeClient(happyPath());

    await expect(removeTeamMember(TEAM, OTHER, true)).resolves.toEqual({ success: true, inviteCode: "invite-1" });
    expect(opsFor("teams", "update")[0].row).toEqual({ invite_code: "invite-1" });
    expect(indexOf("teams", "update")).toBeLessThan(indexOf("team_members", "delete"));
  });

  it("returns the new code with a partial-success reason when the removal fails after rotating", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:delete": dbError() }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(removeTeamMember(TEAM, OTHER, true)).resolves.toEqual({
      success: false,
      reason: "invite_rotated_remove_failed",
      inviteCode: "invite-1",
    });
  });

  it("removes nobody when rotating the link fails", async () => {
    state.admin = createFakeClient(happyPath({ "teams:update": collision }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(removeTeamMember(TEAM, OTHER, true)).resolves.toEqual({ success: false, reason: "invite_code_conflict" });
    expect(opsFor("team_members", "delete")).toEqual([]);
  });

  it("treats a delete that matched 0 rows as a failure", async () => {
    state.admin = createFakeClient(happyPath({ "team_members:delete": ok([]) }));
    await expect(removeTeamMember(TEAM, OTHER)).resolves.toEqual({ success: false, reason: "member_not_found" });
  });
});

// ============================================================
// leaveTeam (R12)
// ============================================================

describe("leaveTeam", () => {
  it("lets a member delete their own row", async () => {
    state.admin = createFakeClient(
      router({ "team_members:select": ok({ role: "member" }), "team_members:delete": ok([{ user_id: ME.id }]) }),
    );

    await expect(leaveTeam(TEAM)).resolves.toEqual({ success: true });
    const [remove] = opsFor("team_members", "delete");
    expect(remove.filters).toEqual({ team_id: TEAM, user_id: ME.id, role: "member" });
    expect(remove.returning).toBe(true);
  });

  it("refuses the owner", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok({ role: "owner" }) }));
    await expect(leaveTeam(TEAM)).resolves.toEqual({ success: false, reason: "owner_cannot_leave" });
    expect(writes()).toEqual([]);
  });

  it("refuses a non-member", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok(null) }));
    await expect(leaveTeam(TEAM)).resolves.toEqual({ success: false, reason: "not_member" });
    expect(writes()).toEqual([]);
  });

  it("treats a delete that matched 0 rows as a failure", async () => {
    state.admin = createFakeClient(router({ "team_members:select": ok({ role: "member" }), "team_members:delete": ok([]) }));
    await expect(leaveTeam(TEAM)).resolves.toEqual({ success: false, reason: "not_member" });
  });

  it("requires a logged-in user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    await expect(leaveTeam(TEAM)).resolves.toEqual({ success: false, reason: "not_logged_in" });
    expect(state.admin.ops).toEqual([]);
  });
});
