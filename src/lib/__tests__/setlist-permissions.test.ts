import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "@/actions/__tests__/fake-supabase";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  user: null as { id: string; nickname: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => mocks.client }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => mocks.user) }));

import { setlistEditorDenial } from "../setlist-permissions";

const HOST = "host";
const MEMBER = "member";

function room(playlist: Record<string, unknown> | null, { member = false, joinError = false } = {}) {
  const { client, ops } = createFakeClient((op: FakeOp): FakeResult => {
    if (op.table === "playlists") return { data: playlist };
    if (op.table === "playlist_members" && op.action === "select") return { data: member ? { user_id: MEMBER } : null };
    if (op.table === "playlist_members" && op.action === "insert") return { error: joinError ? { message: "boom" } : null };
    return { data: null };
  });
  mocks.client = client;
  return ops;
}

const login = { creator_user_id: HOST, default_vote_limit: 3 };

describe("setlistEditorDenial", () => {
  beforeEach(() => {
    mocks.user = { id: MEMBER, nickname: "드럼" };
  });

  it.each([
    ["플레이리스트가 없으면", null, "playlist_not_found"],
    ["보관된 플레이리스트면", { ...login, creator_user_id: null, setlist_edit_mode: "everyone" }, "archived"],
    ["방장만 편집하는 방의 멤버면", { ...login, setlist_edit_mode: "host_only" }, "not_editor"],
  ] as const)("%s 거절한다", async (_name, playlist, reason) => {
    room(playlist);
    await expect(setlistEditorDenial("p")).resolves.toBe(reason);
  });

  it("로그인하지 않았으면 거절한다", async () => {
    room({ ...login, setlist_edit_mode: "everyone" });
    mocks.user = null;
    await expect(setlistEditorDenial("p")).resolves.toBe("not_logged_in");
  });

  it("방장만 편집하는 방도 방장은 통과한다", async () => {
    room({ ...login, setlist_edit_mode: "host_only" });
    mocks.user = { id: HOST, nickname: "보컬" };
    await expect(setlistEditorDenial("p")).resolves.toBeNull();
  });

  it("모두 편집하는 방에 처음 온 멤버는 참여자로 등록하고 통과한다", async () => {
    const ops = room({ ...login, setlist_edit_mode: "everyone" });
    await expect(setlistEditorDenial("p")).resolves.toBeNull();
    expect(ops.find((op) => op.table === "playlist_members" && op.action === "insert")?.row).toEqual({
      playlist_id: "p",
      user_id: MEMBER,
      display_name: "드럼",
      vote_limit: 3,
    });
  });

  it("이미 참여자면 다시 등록하지 않는다", async () => {
    const ops = room({ ...login, setlist_edit_mode: "everyone" }, { member: true });
    await expect(setlistEditorDenial("p")).resolves.toBeNull();
    expect(ops.some((op) => op.table === "playlist_members" && op.action === "insert")).toBe(false);
  });

  it("참여자 등록에 실패하면 거절한다", async () => {
    room({ ...login, setlist_edit_mode: "everyone" }, { joinError: true });
    await expect(setlistEditorDenial("p")).resolves.toBe("write_failed");
  });
});
