import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

// Drives the five host actions and deletePlaylist through the REAL assertPlaylistAdmin.
// Only Supabase and the session are faked.
const state = vi.hoisted(() => ({
  ops: [] as FakeOp[],
  playlist: null as { creator_user_id: string | null } | null,
  user: null as { id: string; nickname: string; avatarUrl: null } | null,
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    const { client, ops } = createFakeClient((op: FakeOp): FakeResult => {
      state.ops.push(op);
      if (op.table === "playlists" && op.action === "select") return { data: state.playlist };
      if (op.table === "playlist_admin") return { data: { admin_token: "link-token" } };
      if (op.table === "songs") return { data: [{ id: "song-1" }] };
      if (op.table === "votes" && op.action === "delete") return { count: 3, error: null };
      if (op.table === "votes") return { data: [] };
      if (op.table === "playlist_members") return { data: [] };
      return { data: null, error: null };
    });
    void ops;
    return { ...client, rpc: state.rpc };
  },
  createServerSupabaseClient: async () => createFakeClient().client,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
vi.mock("nanoid", () => ({ nanoid: () => "nanoid" }));

import { deletePlaylist, resetPlaylistVotes, updateAnnouncementPublic, updateSetlistEditMode } from "../playlist";
import { getVotingSettings, saveVotingSettings } from "../member";

const HOST = "host";
const writes = () => state.ops.filter((op) => op.action !== "select");

type Row = [name: string, playlist: { creator_user_id: string | null }, user: string | null];
const refusedRows: Row[] = [
  ["logged out, live playlist", { creator_user_id: HOST }, null],
  ["logged-in non-host (member or stranger), live playlist", { creator_user_id: HOST }, "member"],
  ["archived playlist, any logged-in user", { creator_user_id: null }, HOST],
  ["archived playlist, logged out", { creator_user_id: null }, null],
];

const actions: [string, () => Promise<unknown>][] = [
  ["updateAnnouncementPublic", () => updateAnnouncementPublic("p", "hi", "abc")],
  ["resetPlaylistVotes", () => resetPlaylistVotes("p", "abc")],
  ["updateSetlistEditMode", () => updateSetlistEditMode("p", "everyone", "abc")],
  ["getVotingSettings", () => getVotingSettings("p")],
  ["saveVotingSettings", () => saveVotingSettings("p", true, "free", 3, [], "abc")],
  // The leaked token must not help on a live playlist nor when logged out.
  ["deletePlaylist with leaked token", () => deletePlaylist("p", "link-token")],
];

beforeEach(() => {
  state.ops.length = 0;
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  state.revalidatePath.mockReset();
});

describe("host actions refuse every non-host row and write nothing", () => {
  for (const [row, playlist, user] of refusedRows) {
    for (const [name, call] of actions) {
      const allowed = name === "deletePlaylist with leaked token" && playlist.creator_user_id === null;
      it(`${name} / ${row}${allowed ? " (allowed: archived delete by token, ADR 0012)" : ""}`, async () => {
        state.playlist = playlist;
        state.user = user ? { id: user, nickname: "n", avatarUrl: null } : null;
        if (allowed) {
          await expect(call()).resolves.toEqual({ success: true });
          expect(writes()).toEqual([expect.objectContaining({ table: "playlists", action: "delete", filters: { id: "p" } })]);
          return;
        }
        await expect(call()).rejects.toThrow();
        expect(writes()).toEqual([]);
        expect(state.rpc).not.toHaveBeenCalled();
        expect(state.revalidatePath).not.toHaveBeenCalled();
      });
    }
  }
});

describe("the host on a live playlist succeeds with no token and writes only to that playlist", () => {
  beforeEach(() => {
    state.playlist = { creator_user_id: HOST };
    state.user = { id: HOST, nickname: "n", avatarUrl: null };
  });

  it("updateAnnouncementPublic", async () => {
    await expect(updateAnnouncementPublic("p", "hi", "abc")).resolves.toEqual({ success: true });
    expect(writes()).toEqual([expect.objectContaining({ table: "playlists", action: "update", filters: { id: "p" } })]);
  });

  it("resetPlaylistVotes deletes only this playlist's songs' votes", async () => {
    await expect(resetPlaylistVotes("p", "abc")).resolves.toEqual({ success: true, deletedCount: 3 });
    expect(writes()).toEqual([expect.objectContaining({ table: "votes", action: "delete", filters: { song_id: ["song-1"] } })]);
    expect(state.revalidatePath).toHaveBeenCalledWith("/playlist/abc");
  });

  it("resetPlaylistVotes under old-tab argument order: same target, wrong revalidate path only", async () => {
    // Old bundle calls (playlistId, adminToken, shareCode); the new action reads (playlistId, shareCode).
    await expect((resetPlaylistVotes as unknown as (...a: unknown[]) => Promise<unknown>)("p", "link-token", "abc")).resolves.toEqual({ success: true, deletedCount: 3 });
    expect(writes()).toEqual([expect.objectContaining({ table: "votes", action: "delete", filters: { song_id: ["song-1"] } })]);
    expect(state.revalidatePath).toHaveBeenCalledWith("/playlist/link-token");
  });

  it("updateSetlistEditMode under old-tab argument order fails on the input guard and writes nothing", async () => {
    await expect((updateSetlistEditMode as unknown as (...a: unknown[]) => Promise<unknown>)("p", "link-token", "everyone", "abc")).rejects.toThrow();
    expect(writes()).toEqual([]);
  });

  it("saveVotingSettings under old-tab argument order fails on the input guard and never reaches the RPC", async () => {
    await expect((saveVotingSettings as unknown as (...a: unknown[]) => Promise<unknown>)("p", "link-token", true, "free", 3, [], "abc")).rejects.toThrow();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("deletePlaylist with no token on a live playlist (host from another device)", async () => {
    await expect(deletePlaylist("p", null)).resolves.toEqual({ success: true });
  });
});
