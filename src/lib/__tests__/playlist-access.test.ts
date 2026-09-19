import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ single: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  }),
}));

import { assertPlaylistWritable } from "../playlist-access";
import { ARCHIVED_PLAYLIST_MESSAGE, isArchivedPlaylist } from "../playlist-archive";

describe("isArchivedPlaylist", () => {
  it("treats a room without a creator account as archived", () => {
    expect(isArchivedPlaylist({ creator_user_id: null })).toBe(true);
    expect(isArchivedPlaylist({ creator_user_id: "host" })).toBe(false);
  });
});

describe("assertPlaylistWritable", () => {
  beforeEach(() => mocks.single.mockReset());

  it("rejects writes to an archived room", async () => {
    mocks.single.mockResolvedValue({ data: { creator_user_id: null } });
    await expect(assertPlaylistWritable("playlist")).rejects.toThrow(
      ARCHIVED_PLAYLIST_MESSAGE,
    );
  });

  it("allows writes to a login room", async () => {
    mocks.single.mockResolvedValue({ data: { creator_user_id: "host" } });
    await expect(assertPlaylistWritable("playlist")).resolves.toBeUndefined();
  });

  it("rejects a room that no longer exists", async () => {
    mocks.single.mockResolvedValue({ data: null });
    await expect(assertPlaylistWritable("playlist")).rejects.toThrow(
      "합주방을 찾을 수 없습니다.",
    );
  });
});
