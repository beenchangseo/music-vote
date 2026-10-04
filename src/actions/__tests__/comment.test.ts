import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

const state = vi.hoisted(() => ({
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  session: null as unknown as ReturnType<typeof createFakeClient>,
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => state.admin.client,
  createServerSupabaseClient: async () => state.session.client,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1", nickname: "베이스", avatarUrl: null })),
}));
vi.mock("@/lib/playlist-access", () => ({
  assertPlaylistWritableBySong: vi.fn(async () => "playlist-1"),
}));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));

import { addOrUpdateComment, deleteComment } from "../comment";

const ok = (data: unknown = null): FakeResult => ({ data, error: null });

/**
 * The session client as it behaves after v18: comments cannot be selected, so a
 * lookup finds nothing, and the unique index rejects a second insert.
 */
function lockedSession() {
  return createFakeClient((op: FakeOp) => {
    if (op.table === "comments" && op.action === "insert") {
      return { error: { code: "23505", message: "uq_comments_song_user" } };
    }
    return op.action === "select" ? ok(null) : ok([]);
  });
}

const inserts = (ops: FakeOp[]) => ops.filter((op) => op.action === "insert");

describe("addOrUpdateComment", () => {
  beforeEach(() => {
    state.session = lockedSession();
    state.revalidatePath.mockReset();
  });

  it("updates my existing comment in place instead of inserting a duplicate", async () => {
    state.admin = createFakeClient((op) => {
      if (op.action === "select") return ok({ id: "comment-1" });
      if (op.action === "update") return ok([{ id: "comment-1" }]);
      return ok();
    });

    await expect(addOrUpdateComment("song-1", "  다음 합주 땐 키 내려요  ", "share")).resolves.toEqual({
      success: true,
    });

    const [lookup, update] = state.admin.ops;
    expect(lookup).toMatchObject({
      table: "comments",
      action: "select",
      filters: { song_id: "song-1", user_id: "user-1" },
    });
    expect(update).toMatchObject({
      table: "comments",
      action: "update",
      filters: { id: "comment-1", user_id: "user-1" },
      returning: true,
    });
    expect(update.row?.content).toBe("다음 합주 땐 키 내려요");
    expect(inserts(state.admin.ops)).toEqual([]);
    expect(inserts(state.session.ops)).toEqual([]);
    expect(state.revalidatePath).toHaveBeenCalledWith("/playlist/share");
  });

  it("treats an update that matched no rows as a failure", async () => {
    state.admin = createFakeClient((op) => {
      if (op.action === "select") return ok({ id: "comment-1" });
      if (op.action === "update") return ok([]);
      return ok();
    });

    await expect(addOrUpdateComment("song-1", "수정", "share")).rejects.toThrow("댓글 수정에 실패했습니다.");
    expect(inserts(state.session.ops)).toEqual([]);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("inserts a first comment under the session user's own id", async () => {
    state.admin = createFakeClient(() => ok(null));
    state.session = createFakeClient(() => ok());

    await expect(addOrUpdateComment("song-1", "좋아요", "share")).resolves.toEqual({ success: true });

    const [insert] = inserts(state.session.ops);
    expect(insert.row).toMatchObject({ song_id: "song-1", user_id: "user-1", nickname: "베이스" });
    expect(inserts(state.admin.ops)).toEqual([]);
  });
});

describe("deleteComment", () => {
  beforeEach(() => {
    state.session = lockedSession();
    state.revalidatePath.mockReset();
  });

  it("deletes only my comment and confirms a row was removed", async () => {
    state.admin = createFakeClient((op) => (op.action === "delete" ? ok([{ id: "comment-1" }]) : ok()));

    await expect(deleteComment("song-1", "share")).resolves.toEqual({ success: true });

    expect(state.admin.ops).toHaveLength(1);
    expect(state.admin.ops[0]).toMatchObject({
      table: "comments",
      action: "delete",
      filters: { song_id: "song-1", user_id: "user-1" },
      returning: true,
    });
    expect(state.revalidatePath).toHaveBeenCalledWith("/playlist/share");
  });

  it("treats a delete that matched no rows as a failure", async () => {
    state.admin = createFakeClient((op) => (op.action === "delete" ? ok([]) : ok()));

    await expect(deleteComment("song-1", "share")).rejects.toThrow("댓글 삭제에 실패했습니다.");
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});
