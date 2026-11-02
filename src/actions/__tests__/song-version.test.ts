import { beforeEach, describe, expect, it, vi } from "vitest";
import { ARCHIVED_PLAYLIST_MESSAGE } from "@/domain/playlist-archive";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

const state = vi.hoisted(() => ({
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  user: { id: "user-1", nickname: "베이스", avatarUrl: null } as { id: string; nickname: string; avatarUrl: null } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => state.admin.client,
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/youtube", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/youtube")>()),
  fetchVideoMetadata: vi.fn(async () => ({ title: "Live ver.", thumbnail_url: null })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addSongVersion, deleteSongVersion, getSongVersions, updateSongVersion } from "../song-version";

const ok = (data: unknown = null): FakeResult => ({ data, error: null });
const URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const writes = (ops: FakeOp[]) => ops.filter((op) => op.action !== "select");

/** A song in a playlist whose host is `creator` (null = archived, pre-login playlist). */
function db(creator: string | null, version = { added_by_user_id: "user-2" }) {
  return createFakeClient((op) => {
    if (op.table === "songs") {
      return ok({ id: "song-1", playlist_id: "playlist-1", youtube_video_id: "orig", playlists: { creator_user_id: creator } });
    }
    if (op.table === "song_versions" && op.action === "select" && op.filters.id) {
      return ok({
        id: "version-1",
        song_id: "song-1",
        ...version,
        songs: { playlist_id: "playlist-1", youtube_video_id: "orig", playlists: { creator_user_id: creator } },
      });
    }
    if (op.table === "song_versions" && op.action === "select") return ok([]);
    if (op.table === "playlist_admin") return ok({ admin_token: "token" });
    return ok({ id: "version-1" });
  });
}

describe("song versions on an archived playlist (ADR 0012)", () => {
  beforeEach(() => {
    state.user = null;
  });

  it("refuses to add a version, even with a nickname and no login", async () => {
    state.admin = db(null);
    await expect(addSongVersion("song-1", URL, "", "share", true)).rejects.toThrow(ARCHIVED_PLAYLIST_MESSAGE);
    expect(writes(state.admin.ops)).toEqual([]);
  });

  it("refuses to edit or delete a version", async () => {
    state.admin = db(null);
    await expect(updateSongVersion("version-1", URL, "", "share", true)).rejects.toThrow(ARCHIVED_PLAYLIST_MESSAGE);
    await expect(deleteSongVersion("version-1", "share")).rejects.toThrow(ARCHIVED_PLAYLIST_MESSAGE);
    expect(writes(state.admin.ops)).toEqual([]);
  });
});

describe("song versions on a login playlist", () => {
  beforeEach(() => {
    state.user = { id: "user-1", nickname: "베이스", avatarUrl: null };
  });

  it("adds a version as the logged-in user", async () => {
    state.admin = db("host-1");
    await expect(addSongVersion("song-1", URL, " 라이브 ", "share", true)).resolves.toMatchObject({ success: true });
    const insert = state.admin.ops.find((op) => op.action === "insert");
    expect(insert?.row).toMatchObject({ added_by_user_id: "user-1", added_by_nickname: "베이스", description: "라이브" });
  });

  it("asks for login before adding", async () => {
    state.user = null;
    state.admin = db("host-1");
    await expect(addSongVersion("song-1", URL, "", "share", true)).rejects.toThrow("로그인이 필요합니다.");
    expect(writes(state.admin.ops)).toEqual([]);
  });

  it("lets only the host or the person who added it delete a version", async () => {
    state.admin = db("host-1", { added_by_user_id: "user-2" });
    await expect(deleteSongVersion("version-1", "share")).rejects.toThrow("이 링크를 수정할 권한이 없습니다.");

    state.admin = db("host-1", { added_by_user_id: "user-1" });
    await expect(deleteSongVersion("version-1", "share")).resolves.toEqual({ success: true });
  });
});

describe("what the screen gets back about versions (ADR 0011)", () => {
  const row = (id: string, addedBy: string | null) => ({
    id,
    song_id: "song-1",
    youtube_url: URL,
    youtube_video_id: "dQw4w9WgXcQ",
    title: id,
    thumbnail_url: null,
    description: null,
    added_by_user_id: addedBy,
    added_by_nickname: "기타",
    created_at: "t",
    updated_at: "t",
  });

  function versions(creator: string | null) {
    return createFakeClient((op) => {
      if (op.table === "songs") return ok({ playlists: { creator_user_id: creator } });
      return op.table === "song_versions" ? ok([row("theirs", "user-2"), row("mine", "user-1")]) : ok(null);
    });
  }

  const manage = (list: { id: string; canManage: boolean }[]) => Object.fromEntries(list.map((v) => [v.id, v.canManage]));

  it.each([
    ["the member who added one", { id: "user-1", nickname: "베이스", avatarUrl: null }, "host-1", { theirs: false, mine: true }],
    ["the host", { id: "host-1", nickname: "보컬", avatarUrl: null }, "host-1", { theirs: true, mine: true }],
    ["a logged-out visitor", null, "host-1", { theirs: false, mine: false }],
    ["the adder in an archived playlist", { id: "user-1", nickname: "베이스", avatarUrl: null }, null, { theirs: false, mine: false }],
  ] as const)("tells %s which versions they manage, without any account id", async (_viewer, user, creator, expected) => {
    state.user = user;
    state.admin = versions(creator);

    const list = await getSongVersions("song-1");

    expect(manage(list)).toEqual(expected);
    for (const id of ["user-1", "user-2", "host-1"]) expect(JSON.stringify(list)).not.toContain(id);
    expect(state.admin.ops[0]).toMatchObject({ table: "song_versions", filters: { song_id: "song-1" } });
  });

  it("hands back an added or edited version as mine to manage, without my account id", async () => {
    state.user = { id: "user-1", nickname: "베이스", avatarUrl: null };
    const saved: Record<string, unknown> = row("mine", "user-1");
    const respond = (op: FakeOp) => {
      if (op.table === "songs") return ok({ youtube_video_id: "orig", playlist_id: "playlist-1", playlists: { creator_user_id: "host-1" } });
      if (op.table === "song_versions" && op.action === "select" && op.filters.id) {
        return ok({ id: "mine", song_id: "song-1", added_by_user_id: "user-1", songs: { youtube_video_id: "orig", playlists: { creator_user_id: "host-1" } } });
      }
      if (op.table === "song_versions" && op.action === "select") return ok([]);
      // Like PostgREST, a write answers only the columns it asked for.
      const columns = (op.columns ?? "").split(",").map((column) => column.trim());
      return ok(op.returning && op.columns ? Object.fromEntries(columns.map((column) => [column, saved[column]])) : saved);
    };

    state.admin = createFakeClient(respond);
    const added = await addSongVersion("song-1", URL, "", "share", true);
    state.admin = createFakeClient(respond);
    const edited = await updateSongVersion("mine", URL, "", "share", true);

    for (const result of [added, edited]) {
      expect(result).toMatchObject({ success: true, version: { id: "mine", canManage: true } });
      expect(JSON.stringify(result)).not.toContain("user-1");
    }
  });
});
