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

  it("reads only the session user's rooms through the admin client", async () => {
    state.getCurrentUser.mockResolvedValue(USER);
    state.admin = createFakeClient((op) =>
      op.table === "playlists"
        ? ok([{ id: "pl-1", share_code: "code-1", title: "주말 합주", created_at: "2026-10-01" }])
        : ok(),
    );

    await expect(getMyPlaylists()).resolves.toEqual([
      { id: "pl-1", shareCode: "code-1", title: "주말 합주" },
    ]);
    expect(state.admin.ops).toHaveLength(1);
    expect(state.admin.ops[0]).toMatchObject({
      table: "playlists",
      action: "select",
      filters: { creator_user_id: USER.id },
    });
    // The session client cannot select playlists after v18.
    expect(state.session.ops).toEqual([]);
  });
});
