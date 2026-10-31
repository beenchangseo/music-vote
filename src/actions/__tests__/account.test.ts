import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

type AuthResult = { data: unknown; error: { status?: number; code?: string; message: string } | null };

const state = vi.hoisted(() => ({
  timeline: [] as string[],
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  respond: null as unknown as (op: FakeOp) => FakeResult,
  getCurrentUser: vi.fn(),
  getUserById: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    ...state.admin.client,
    auth: { admin: { getUserById: state.getUserById, deleteUser: state.deleteUser } },
  }),
  createServerSupabaseClient: async () => ({ auth: { signOut: state.signOut } }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: state.getCurrentUser }));

import { deleteAccount } from "../account";

const ME = { id: "user-me", nickname: "보컬", avatarUrl: null };
const KAKAO_ID = "4242424242";
const FORGED_KAKAO_ID = "9999999999";
const HOSTED = [{ id: "room-1" }, { id: "room-2" }];
const LEFT = "탈퇴한 멤버";

const ok = (data: unknown = null): FakeResult => ({ data, error: null });
const dbError: FakeResult = { data: null, error: { code: "XX000", message: "boom" } };
const answer = (op: FakeOp): FakeResult =>
  op.table === "playlists" && op.action === "select" ? ok(HOSTED) : ok();

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

const CLEANUP = [
  { table: "songs", action: "update", row: { added_by: LEFT }, filters: { added_by_user_id: ME.id } },
  { table: "song_versions", action: "update", row: { added_by_nickname: LEFT }, filters: { added_by_user_id: ME.id } },
  { table: "playlists", action: "update", row: { creator_nickname: LEFT }, filters: { creator_user_id: ME.id } },
  { table: "playlist_admin", action: "delete", row: undefined, filters: { playlist_id: ["room-1", "room-2"] } },
];

const at = (step: string) => state.timeline.indexOf(step);

beforeEach(() => {
  state.timeline = [];
  state.respond = answer;
  state.admin = createFakeClient((op) => {
    state.timeline.push(`${op.table}:${op.action}`);
    return state.respond(op);
  });
  state.getCurrentUser.mockReset().mockResolvedValue(ME);
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

    expect(await deleteAccount()).toEqual({ success: false, reason: "kakao_unlink_failed" });
    expect(writes()).toEqual([]);
    expect(state.deleteUser).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();

    state.fetch.mockImplementation(kakaoReply(200, { id: Number(KAKAO_ID) }));
    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("goes on when Kakao says the account is no longer linked", async () => {
    state.fetch.mockImplementation(kakaoReply(400, { code: -101, msg: "not registered user" }));

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete a Kakao account while the Kakao admin key is missing", async () => {
    vi.stubEnv("KAKAO_ADMIN_KEY", "");

    expect(await deleteAccount()).toEqual({ success: false, reason: "kakao_unlink_failed" });
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

  it("treats an account that is already gone as deleted", async () => {
    state.deleteUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 404, code: "user_not_found", message: "User not found" },
    });

    expect(await deleteAccount()).toEqual({ success: true });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
