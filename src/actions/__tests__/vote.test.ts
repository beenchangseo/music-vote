import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user", nickname: "참여자" })),
}));
vi.mock("@/lib/playlist-mode", () => ({
  getPlaylistModeBySong: vi.fn(async () => ({ requiresLogin: true })),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { castVote } from "../vote";

describe("castVote", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("returns an expected result when the vote allowance is exhausted", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "투표권을 모두 사용했습니다.",
      },
    });

    await expect(castVote("song", "참여자", 1, "share")).resolves.toEqual({
      success: false,
      reason: "vote_limit_reached",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
