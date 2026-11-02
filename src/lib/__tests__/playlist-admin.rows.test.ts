import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "@/actions/__tests__/fake-supabase";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  user: null as { id: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => mocks.client }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => mocks.user) }));

import { assertPlaylistAdmin, playlistAdminDenial } from "../playlist-admin";

const HOST = "host";
const LINK_TOKEN = "link-token";

function room(playlist: { creator_user_id: string | null } | null) {
  const { client } = createFakeClient((op: FakeOp): FakeResult => {
    if (op.table === "playlists") return { data: playlist };
    if (op.table === "playlist_admin") return { data: { admin_token: LINK_TOKEN } };
    return { data: null };
  });
  mocks.client = client;
}

describe("playlistAdminDenial and assertPlaylistAdmin on live and archived playlists", () => {
  beforeEach(() => {
    mocks.user = null;
  });

  it("logged out on a live playlist: refused, denial not_logged_in", async () => {
    room({ creator_user_id: HOST });
    await expect(playlistAdminDenial("p")).resolves.toBe("not_logged_in");
    await expect(assertPlaylistAdmin("p")).rejects.toThrow();
  });

  it("logged out holding a leaked link token on a live playlist (deletePlaylist path): refused", async () => {
    room({ creator_user_id: HOST });
    await expect(assertPlaylistAdmin("p", { adminToken: LINK_TOKEN })).rejects.toThrow();
  });

  it("missing playlist: refused, denial playlist_not_found", async () => {
    room(null);
    mocks.user = { id: HOST };
    await expect(playlistAdminDenial("p")).resolves.toBe("playlist_not_found");
    await expect(assertPlaylistAdmin("p")).rejects.toThrow();
    await expect(assertPlaylistAdmin("p", { adminToken: LINK_TOKEN })).rejects.toThrow();
  });

  it("host on a live playlist passes with or without a token in the delete path", async () => {
    room({ creator_user_id: HOST });
    mocks.user = { id: HOST };
    await expect(assertPlaylistAdmin("p", { adminToken: null })).resolves.toBeUndefined();
    await expect(assertPlaylistAdmin("p", { adminToken: "wrong" })).resolves.toBeUndefined();
  });

  it("archived playlist: a logged-in user who is not the creator but holds the token may delete, nothing else", async () => {
    room({ creator_user_id: null });
    mocks.user = { id: "someone" };
    await expect(playlistAdminDenial("p")).resolves.toBe("archived");
    await expect(assertPlaylistAdmin("p")).rejects.toThrow();
    await expect(assertPlaylistAdmin("p", { adminToken: LINK_TOKEN })).resolves.toBeUndefined();
  });
});
