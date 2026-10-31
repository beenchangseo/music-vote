import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

type AuthResult = { data: unknown; error: { status?: number; code?: string; message: string } | null };

const state = vi.hoisted(() => ({
  timeline: [] as string[],
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  respond: null as unknown as (op: FakeOp) => FakeResult,
  ownedBands: [] as unknown[],
  getCurrentUser: vi.fn(),
  getUserById: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  fetch: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    ...state.admin.client,
    auth: { admin: { getUserById: state.getUserById, deleteUser: state.deleteUser } },
  }),
  createServerSupabaseClient: async () => ({ auth: { signOut: state.signOut } }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: state.getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));

import { deleteAccount, previewAccountDeletion } from "../account";

const ME = { id: "user-me", nickname: "보컬", avatarUrl: null };
const KAKAO_ID = "4242424242";
const FORGED_KAKAO_ID = "9999999999";
const HOSTED = [{ id: "room-1" }, { id: "room-2" }];
const LEFT = "탈퇴한 멤버";

const ok = (data: unknown = null): FakeResult => ({ data, error: null });
const dbError: FakeResult = { data: null, error: { code: "XX000", message: "boom" } };

type MemberRow = { user_id: string; display_name: string; role: "owner" | "member"; joined_at: string };
const OWNER_ME: MemberRow = { user_id: ME.id, display_name: "보컬", role: "owner", joined_at: "2026-10-01T00:00:00+00:00" };
const GUITAR: MemberRow = { user_id: "user-guitar", display_name: "기타", role: "member", joined_at: "2026-10-02T00:00:00+00:00" };
const DRUM: MemberRow = { user_id: "user-drum", display_name: "드럼", role: "member", joined_at: "2026-10-03T00:00:00+00:00" };
const band = (team_id: string, name: string, members: MemberRow[]) => ({ team_id, teams: { name, team_members: members } });

// Bands answer only the lookup for bands I own, so a query that also picks up bands where I am
// a plain member hands over nothing.
const answer = (op: FakeOp): FakeResult => {
  if (op.table === "playlists" && op.action === "select") return ok(HOSTED);
  if (op.table === "team_members" && op.action === "select") {
    return ok(op.filters.user_id === ME.id && op.filters.role === "owner" ? state.ownedBands : []);
  }
  if (op.table === "team_members" && op.action === "update") return ok([{ user_id: op.filters.user_id }]);
  return ok();
};

const kakaoUser = {
  id: ME.id,
  user_metadata: { provider_id: FORGED_KAKAO_ID, sub: FORGED_KAKAO_ID },
  identities: [{ id: KAKAO_ID, identity_id: "identity-1", user_id: ME.id, provider: "kakao" }],
};

const kakaoReply = (status: number, body: unknown) => async () => {
  state.timeline.push("kakao:unlink");
  return new Response(JSON.stringify(body), { status });
};

const writes = () =>
  state.admin.ops
    .filter((op) => op.action !== "select")
    .map(({ table, action, row, filters }) => ({ table, action, row, filters }));

const handovers = () => writes().filter((op) => op.table === "team_members");

const CLEANUP = [
  { table: "songs", action: "update", row: { added_by: LEFT }, filters: { added_by_user_id: ME.id } },
  { table: "song_versions", action: "update", row: { added_by_nickname: LEFT }, filters: { added_by_user_id: ME.id } },
  { table: "playlists", action: "update", row: { creator_nickname: LEFT }, filters: { creator_user_id: ME.id } },
  { table: "playlist_admin", action: "delete", row: undefined, filters: { playlist_id: ["room-1", "room-2"] } },
];

const at = (step: string) => state.timeline.indexOf(step);

beforeEach(() => {
  state.timeline = [];
  state.ownedBands = [];
  state.respond = answer;
  state.admin = createFakeClient((op) => {
    state.timeline.push(`${op.table}:${op.action}`);
    return state.respond(op);
  });
  state.getCurrentUser.mockReset().mockResolvedValue(ME);
  state.revalidatePath.mockReset();
  state.getUserById.mockReset().mockResolvedValue({ data: { user: kakaoUser }, error: null } satisfies AuthResult);
  state.deleteUser.mockReset().mockImplementation(async (): Promise<AuthResult> => {
    state.timeline.push("auth:deleteUser");
    return { data: { user: null }, error: null };
  });
  state.signOut.mockReset().mockImplementation(async () => {
    state.timeline.push("auth:signOut");
    return { error: null };
  });
  state.fetch.mockReset().mockImplementation(kakaoReply(200, { id: Number(KAKAO_ID) }));
  vi.stubGlobal("fetch", state.fetch);
  vi.stubEnv("KAKAO_ADMIN_KEY", "test-admin-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("deleteAccount", () => {
  it("refuses a signed-out caller and changes nothing", async () => {
    state.getCurrentUser.mockResolvedValue(null);

    expect(await deleteAccount()).toEqual({ success: false, reason: "not_logged_in" });
    expect(state.timeline).toEqual([]);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.deleteUser).not.toHaveBeenCalled();
  });

  it("unlinks Kakao, clears the member from kept rows, deletes the account, then signs out", async () => {
    expect(await deleteAccount()).toEqual({ success: true });

    const [url, init] = state.fetch.mock.calls[0];
    expect(url).toBe("https://kapi.kakao.com/v1/user/unlink");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("KakaoAK test-admin-key");
    const body = new URLSearchParams(init.body);
    expect(body.get("target_id_type")).toBe("user_id");
    expect(body.get("target_id")).toBe(KAKAO_ID);

    expect(writes()).toHaveLength(CLEANUP.length);
    expect(writes()).toEqual(expect.arrayContaining(CLEANUP));

    expect(state.deleteUser).toHaveBeenCalledTimes(1);
    expect(state.deleteUser.mock.calls[0][0]).toBe(ME.id);
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });

    for (const write of CLEANUP) {
      expect(at(`${write.table}:${write.action}`)).toBeGreaterThan(at("kakao:unlink"));
      expect(at(`${write.table}:${write.action}`)).toBeLessThan(at("auth:deleteUser"));
    }
    expect(at("auth:signOut")).toBeGreaterThan(at("auth:deleteUser"));
  });

  it("unlinks the Kakao id from the login identity, not from editable profile metadata", async () => {
    await deleteAccount();

    expect(state.getUserById).toHaveBeenCalledWith(ME.id);
    expect(new URLSearchParams(state.fetch.mock.calls[0][1].body).get("target_id")).toBe(KAKAO_ID);
  });

  it("changes nothing when Kakao refuses the unlink, and a retry finishes", async () => {
    state.fetch.mockImplementation(kakaoReply(401, { code: -401, msg: "invalid app key" }));
    state.ownedBands = [band("band-1", "주말밴드", [OWNER_ME, GUITAR])];

    expect(await deleteAccount()).toEqual({ success: false, reason: "kakao_unlink_failed" });
    expect(writes()).toEqual([]);
    expect(state.deleteUser).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();

    state.fetch.mockImplementation(kakaoReply(200, { id: Number(KAKAO_ID) }));
    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it.each([-101, -103])(
    "goes on when Kakao answers %i (already unlinked) and logs the code with only the internal user id",
    async (code) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      state.fetch.mockImplementation(kakaoReply(400, { code, msg: "not registered user" }));

      expect(await deleteAccount()).toEqual({ success: true });
      expect(state.deleteUser).toHaveBeenCalledTimes(1);

      const logged = info.mock.calls.map((args) => args.join(" "));
      expect(logged.some((line) => line.includes(String(code)) && line.includes(ME.id))).toBe(true);
      expect(logged.join("\n")).not.toContain(KAKAO_ID);
      expect(logged.join("\n")).not.toContain(ME.nickname);
    },
  );

  it("does not log an already-unlinked line when Kakao really unlinked", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await deleteAccount()).toEqual({ success: true });
    expect(info).not.toHaveBeenCalled();
  });

  it("says deletion is unavailable, not a passing failure, while the Kakao admin key is missing", async () => {
    vi.stubEnv("KAKAO_ADMIN_KEY", "");
    state.ownedBands = [band("band-1", "주말밴드", [OWNER_ME, GUITAR])];

    expect(await deleteAccount()).toEqual({ success: false, reason: "not_available" });
    expect(state.fetch).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
    expect(state.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes an account without a Kakao login and never calls Kakao", async () => {
    state.getUserById.mockResolvedValue({ data: { user: { ...kakaoUser, identities: [] } }, error: null });

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("keeps the account when a rename fails, and a retry converges", async () => {
    state.respond = (op) => (op.table === "songs" && op.action === "update" ? dbError : answer(op));

    expect(await deleteAccount()).toEqual({ success: false, reason: "write_failed" });
    expect(state.deleteUser).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();

    state.respond = answer;
    state.admin.ops.length = 0;
    expect(await deleteAccount()).toEqual({ success: true });
    expect(writes()).toEqual(expect.arrayContaining(CLEANUP));
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("stays signed in when the account delete fails, and a retry finishes it", async () => {
    state.deleteUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 500, message: "boom" } });

    expect(await deleteAccount()).toEqual({ success: false, reason: "write_failed" });
    expect(state.signOut).not.toHaveBeenCalled();

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.deleteUser).toHaveBeenCalledTimes(2);
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });

  it("reports success when signing out of this device throws after the account is gone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.signOut.mockRejectedValueOnce(new Error("cookie write failed"));

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("hands a band I own to its earliest-joined member before the account goes", async () => {
    state.ownedBands = [band("band-1", "주말밴드", [OWNER_ME, DRUM, GUITAR])];

    expect(await deleteAccount()).toEqual({ success: true });

    expect(handovers()).toEqual([
      {
        table: "team_members",
        action: "update",
        row: { role: "owner" },
        filters: { team_id: "band-1", user_id: GUITAR.user_id },
      },
    ]);
    expect(at("team_members:update")).toBeGreaterThan(at("kakao:unlink"));
    expect(at("team_members:update")).toBeLessThan(at("auth:deleteUser"));
  });

  it("hands over every band I own, and none where I am a plain member", async () => {
    state.ownedBands = [
      band("band-1", "주말밴드", [OWNER_ME, GUITAR]),
      band("band-2", "평일밴드", [DRUM, OWNER_ME]),
    ];

    expect(await deleteAccount()).toEqual({ success: true });

    expect(handovers().map((op) => op.filters)).toEqual(
      expect.arrayContaining([
        { team_id: "band-1", user_id: GUITAR.user_id },
        { team_id: "band-2", user_id: DRUM.user_id },
      ]),
    );
    expect(handovers()).toHaveLength(2);
  });

  it("refreshes the home of each band it hands over, and of no other band", async () => {
    state.ownedBands = [
      band("band-1", "주말밴드", [OWNER_ME, GUITAR]),
      band("band-2", "혼자밴드", [OWNER_ME]),
      band("band-3", "넘긴밴드", [OWNER_ME, { ...DRUM, role: "owner" }]),
    ];

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.revalidatePath.mock.calls).toEqual([["/band/band-1"]]);
  });

  it("leaves a band with no other members as it is", async () => {
    state.ownedBands = [band("band-1", "혼자밴드", [OWNER_ME])];

    expect(await deleteAccount()).toEqual({ success: true });
    expect(handovers()).toEqual([]);
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("does not hand a band over again when an earlier try already did", async () => {
    state.ownedBands = [band("band-1", "주말밴드", [OWNER_ME, GUITAR, { ...DRUM, role: "owner" }])];

    expect(await deleteAccount()).toEqual({ success: true });
    expect(handovers()).toEqual([]);
  });

  it("keeps the account when the next owner left the band mid-way, and a retry hands it to the next member", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.ownedBands = [band("band-1", "주말밴드", [OWNER_ME, GUITAR, DRUM])];
    state.respond = (op) => (op.table === "team_members" && op.action === "update" ? ok([]) : answer(op));

    expect(await deleteAccount()).toEqual({ success: false, reason: "write_failed" });
    expect(state.deleteUser).not.toHaveBeenCalled();

    state.ownedBands = [band("band-1", "주말밴드", [OWNER_ME, DRUM])];
    state.respond = answer;
    state.admin.ops.length = 0;
    expect(await deleteAccount()).toEqual({ success: true });
    expect(handovers().map((op) => op.filters)).toEqual([{ team_id: "band-1", user_id: DRUM.user_id }]);
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("keeps the account when the band lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.respond = (op) => (op.table === "team_members" && op.action === "select" ? dbError : answer(op));

    expect(await deleteAccount()).toEqual({ success: false, reason: "write_failed" });
    expect(state.deleteUser).not.toHaveBeenCalled();
  });

  it("treats an account that is already gone as deleted", async () => {
    state.deleteUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 404, code: "user_not_found", message: "User not found" },
    });

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("previewAccountDeletion", () => {
  it("refuses a signed-out caller", async () => {
    state.getCurrentUser.mockResolvedValue(null);

    expect(await previewAccountDeletion()).toEqual({ success: false, reason: "not_logged_in" });
    expect(state.admin.ops).toEqual([]);
  });

  it("names who takes over each band I own, skips bands no one else is in, and writes nothing", async () => {
    state.ownedBands = [
      band("band-1", "주말밴드", [OWNER_ME, DRUM, GUITAR]),
      band("band-2", "혼자밴드", [OWNER_ME]),
      band("band-3", "평일밴드", [OWNER_ME, { ...DRUM, role: "owner" }]),
    ];

    const result = await previewAccountDeletion();

    expect(result).toEqual({
      success: true,
      handovers: [
        { bandName: "주말밴드", ownerName: "기타" },
        { bandName: "평일밴드", ownerName: "드럼" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("user-");
    expect(writes()).toEqual([]);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("reports a failed band lookup instead of an empty list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.respond = (op) => (op.table === "team_members" ? dbError : answer(op));

    expect(await previewAccountDeletion()).toEqual({ success: false, reason: "read_failed" });
  });
});
