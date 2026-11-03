// Drives the two member-key write paths through their public interface with keys minted by the
// same server and asserts what the database would see.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

const HOST = "9c1f6a2e-1111-4111-8111-000000000001";
const GUITAR = "9c1f6a2e-2222-4222-8222-000000000002";
const DRUM = "9c1f6a2e-3333-4333-8333-000000000003";
const NAMES: Record<string, string> = { [HOST]: "보컬", [GUITAR]: "기타", [DRUM]: "드럼" };

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; nickname: string; avatarUrl: null },
  playlistMembers: {} as Record<string, string[]>,
  teamMembers: {} as Record<string, { user_id: string; role: "owner" | "member" }[]>,
  rpc: vi.fn(),
  admin: null as unknown as ReturnType<typeof createFakeClient>,
}));

const ok = (data: unknown = null): FakeResult => ({ data, error: null });

function respond(op: FakeOp): FakeResult {
  if (op.table === "playlists" && op.action === "select") {
    if (op.filters.team_id) return ok([]);
    return ok({ id: op.filters.id, voting_mode: "allocated", votes_anonymous: true, default_vote_limit: 3, creator_user_id: HOST });
  }
  if (op.table === "playlist_members" && op.action === "select") {
    const ids = state.playlistMembers[op.filters.playlist_id as string] ?? [];
    return ok(ids.map((id, i) => ({ user_id: id, display_name: NAMES[id], vote_limit: 3, joined_at: `t${i}` })));
  }
  if (op.table === "votes") return ok([]);
  if (op.table === "teams" && op.action === "select") {
    return ok({ id: op.filters.id, name: "밴드", invite_code: "aB3_x-9Zq0", next_show_at: null, created_at: "2026-10-04T00:00:00+00:00" });
  }
  if (op.table === "teams" && op.action === "update") return ok([{ id: op.filters.id }]);
  if (op.table === "team_members" && op.action === "select") {
    const rows = state.teamMembers[op.filters.team_id as string] ?? [];
    return ok(rows.map((r, i) => ({ ...r, display_name: NAMES[r.user_id], joined_at: `2026-10-0${i + 4}T00:00:00+00:00` })));
  }
  if (op.table === "team_members" && op.action === "delete") {
    const rows = state.teamMembers[op.filters.team_id as string] ?? [];
    const hit = rows.filter((r) => r.user_id === op.filters.user_id && r.role === op.filters.role);
    return ok(hit.map((r) => ({ user_id: r.user_id })));
  }
  return ok(null);
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ ...state.admin.client, rpc: state.rpc }),
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("nanoid", () => ({ nanoid: () => "invite-1" }));

import { getVotingSettings, saveVotingSettings } from "../member";
import { getTeamHome, removeTeamMember } from "../team";

const writes = () => state.admin.ops.filter((op) => op.action !== "select");
const rpcCalls = () => state.rpc.mock.calls.length;

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  state.admin = createFakeClient(respond);
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  state.user = { id: HOST, nickname: "보컬", avatarUrl: null };
  state.playlistMembers = { p1: [HOST, GUITAR], p2: [HOST, GUITAR, DRUM] };
  state.teamMembers = {
    [TEAM_A]: [{ user_id: HOST, role: "owner" }, { user_id: GUITAR, role: "member" }],
    [TEAM_B]: [{ user_id: HOST, role: "owner" }, { user_id: GUITAR, role: "member" }, { user_id: DRUM, role: "member" }],
  };
});

async function playlistKey(playlistId: string, name: string) {
  const s = await getVotingSettings(playlistId);
  return s.members.find((m) => m.display_name === name)!.memberKey;
}

async function teamKey(teamId: string, name: string) {
  const view = await getTeamHome(teamId);
  if (view?.access !== "member") throw new Error("expected member view");
  return view.members.find((m) => m.displayName === name)!.memberKey;
}

describe("saveVotingSettings authority (real assertPlaylistAdmin)", () => {
  it("refuses a non-host before reading members or calling the RPC", async () => {
    state.user = { id: GUITAR, nickname: "기타", avatarUrl: null };
    await expect(saveVotingSettings("p1", true, "allocated", 3, [], "share")).rejects.toThrow("권한이 없습니다.");
    expect(rpcCalls()).toBe(0);
    expect(state.admin.ops.filter((op) => op.table === "playlist_members")).toEqual([]);
  });

  it("refuses a logged-out caller", async () => {
    state.user = null;
    await expect(saveVotingSettings("p1", true, "allocated", 3, [], "share")).rejects.toThrow("권한이 없습니다.");
    expect(rpcCalls()).toBe(0);
  });

  it("host of p1 and p2 cannot reach p2-only member DRUM through p1 with DRUM's p2 key", async () => {
    const drumInP2 = await playlistKey("p2", "드럼");
    await expect(saveVotingSettings("p1", true, "allocated", 3, [{ memberKey: drumInP2, voteLimit: 0 }], "share")).rejects.toThrow(
      "참여자를 찾을 수 없습니다.",
    );
    expect(rpcCalls()).toBe(0);
  });

  it("one bad key refuses the whole batch, so a valid sibling limit is not written either", async () => {
    const guitarInP1 = await playlistKey("p1", "기타");
    const guitarInP2 = await playlistKey("p2", "기타");
    expect(guitarInP1).not.toBe(guitarInP2);
    await expect(
      saveVotingSettings("p1", true, "allocated", 3, [{ memberKey: guitarInP1, voteLimit: 1 }, { memberKey: guitarInP2, voteLimit: 1 }], "share"),
    ).rejects.toThrow("참여자를 찾을 수 없습니다.");
    expect(rpcCalls()).toBe(0);
  });

  it("the RPC gets exactly the user_id the key was minted for, in the sheet's order", async () => {
    const limits = [
      { memberKey: await playlistKey("p1", "기타"), voteLimit: 1 },
      { memberKey: await playlistKey("p1", "보컬"), voteLimit: 7 },
    ];
    await saveVotingSettings("p1", true, "allocated", 3, limits, "share");
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc.mock.calls[0][1].p_member_limits).toEqual([
      { user_id: GUITAR, vote_limit: 1 },
      { user_id: HOST, vote_limit: 7 },
    ]);
  });

  it("an old tab's { userId } shape is refused without the RPC (deploy skew)", async () => {
    await expect(
      saveVotingSettings("p1", true, "allocated", 3, [{ userId: GUITAR, voteLimit: 1 } as never], "share"),
    ).rejects.toThrow("참여자를 찾을 수 없습니다.");
    expect(rpcCalls()).toBe(0);
  });

  it("a key for someone who left after the sheet loaded is refused, and nobody else is written", async () => {
    const guitar = await playlistKey("p1", "기타");
    state.playlistMembers.p1 = [HOST, DRUM];
    await expect(saveVotingSettings("p1", true, "allocated", 3, [{ memberKey: guitar, voteLimit: 0 }], "share")).rejects.toThrow(
      "참여자를 찾을 수 없습니다.",
    );
    expect(rpcCalls()).toBe(0);
  });
});

describe("removeTeamMember authority", () => {
  it("owner of both bands cannot use GUITAR's band-B key in band A (scope separation holds even with legitimate access to both)", async () => {
    const guitarInB = await teamKey(TEAM_B, "기타");
    const guitarInA = await teamKey(TEAM_A, "기타");
    expect(guitarInB).not.toBe(guitarInA);
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_A, guitarInB, true)).resolves.toEqual({ success: false, reason: "member_not_found" });
    expect(writes()).toEqual([]);
  });

  it("a band-A key for a user who is not in band B names nobody there", async () => {
    state.teamMembers[TEAM_A].push({ user_id: DRUM, role: "member" });
    state.teamMembers[TEAM_B] = [{ user_id: HOST, role: "owner" }, { user_id: GUITAR, role: "member" }];
    const drumInA = await teamKey(TEAM_A, "드럼");
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_B, drumInA)).resolves.toEqual({ success: false, reason: "member_not_found" });
    expect(writes()).toEqual([]);
  });

  it("a non-owner member holding a valid key is refused with no writes", async () => {
    const drumKey = await teamKey(TEAM_B, "드럼");
    state.user = { id: GUITAR, nickname: "기타", avatarUrl: null };
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_B, drumKey, true)).resolves.toEqual({ success: false, reason: "not_team_owner" });
    expect(writes()).toEqual([]);
  });

  it("a non-member cannot even see keys, and a guessed key is refused", async () => {
    state.user = { id: DRUM, nickname: "드럼", avatarUrl: null };
    const view = await getTeamHome(TEAM_A);
    expect(view?.access).toBe("guest");
    expect(JSON.stringify(view)).not.toMatch(/memberKey/);
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_A, "AAAAAAAAAAAAAAAAAAAAAA" as never)).resolves.toEqual({ success: false, reason: "not_team_owner" });
    expect(writes()).toEqual([]);
  });

  it("the owner's own key, and the owner-role row, are never removable", async () => {
    const me = await teamKey(TEAM_A, "보컬");
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_A, me, true)).resolves.toEqual({ success: false, reason: "cannot_remove_self" });
    expect(state.admin.ops).toEqual([]);
  });

  it("target left after the page loaded and another member joined: nobody is removed, no rotation", async () => {
    const guitar = await teamKey(TEAM_A, "기타");
    state.teamMembers[TEAM_A] = [{ user_id: HOST, role: "owner" }, { user_id: DRUM, role: "member" }];
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_A, guitar, true)).resolves.toEqual({ success: false, reason: "member_not_found" });
    expect(writes()).toEqual([]);
  });

  it("a valid key removes exactly that user_id and only in that band, after rotating when asked", async () => {
    const guitar = await teamKey(TEAM_A, "기타");
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_A, guitar, true)).resolves.toEqual({ success: true, inviteCode: "invite-1" });
    const ops = writes();
    expect(ops.map((op) => `${op.table}:${op.action}`)).toEqual(["teams:update", "team_members:delete"]);
    expect(ops[1].filters).toEqual({ team_id: TEAM_A, user_id: GUITAR, role: "member" });
  });

  it("an old tab's raw account id is refused before any write (deploy skew)", async () => {
    state.admin = createFakeClient(respond);
    await expect(removeTeamMember(TEAM_A, GUITAR as never, true)).resolves.toEqual({ success: false, reason: "member_not_found" });
    expect(writes()).toEqual([]);
  });
});

describe("key properties", () => {
  it("keys are 22-char base64url (16 bytes) and differ per scope kind for the same id", async () => {
    const k = await playlistKey("p1", "기타");
    expect(k).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // Same uuid used as a playlist id and as a team id must not produce the same key (domain separation).
    state.playlistMembers[TEAM_A] = [HOST, GUITAR];
    const asPlaylist = await playlistKey(TEAM_A, "기타");
    const asTeam = await teamKey(TEAM_A, "기타");
    expect(asPlaylist).not.toBe(asTeam);
  });

  it("the secret is never in a response", async () => {
    const s = await getVotingSettings("p1");
    expect(JSON.stringify(s)).not.toContain("sb_secret_test");
    const v = await getTeamHome(TEAM_A);
    expect(JSON.stringify(v)).not.toContain("sb_secret_test");
  });
});
