import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: mocks.from }),
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/playlist-admin", () => ({ assertPlaylistAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getHomeStats } from "../playlist";

describe("getHomeStats", () => {
  beforeEach(() => {
    mocks.single.mockReset();
    mocks.select.mockReset().mockReturnValue({ single: mocks.single });
    mocks.from.mockReset().mockReturnValue({ select: mocks.select });
  });

  it("reads the aggregated counts from the home_stats view", async () => {
    mocks.single.mockResolvedValue({
      data: { playlist_count: 12, song_count: 340, participant_count: 57 },
    });

    await expect(getHomeStats()).resolves.toEqual({
      playlists: 12,
      users: 57,
      songs: 340,
    });
    expect(mocks.from).toHaveBeenCalledWith("home_stats");
  });

  it("falls back to zero when the view is unavailable", async () => {
    mocks.single.mockResolvedValue({ data: null });

    await expect(getHomeStats()).resolves.toEqual({
      playlists: 0,
      users: 0,
      songs: 0,
    });
  });
});
