import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user", nickname: "참여자" })),
}));
vi.mock("@/lib/playlist-access", () => ({
  assertPlaylistWritableBySong: vi.fn(async () => "playlist"),
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

    await expect(castVote("song", 1, "share")).resolves.toEqual({
      success: false,
      reason: "vote_limit_reached",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an expected result when the playlist's voting deadline has passed", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "투표가 마감되었습니다.",
      },
    });

    await expect(castVote("song", 1, "share")).resolves.toEqual({
      success: false,
      reason: "voting_closed",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("saves the vote and returns the allowance while voting is open", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ result: "added", used_votes: 2, vote_limit: 3 }],
      error: null,
    });

    await expect(castVote("song", 1, "share")).resolves.toEqual({
      success: true,
      allowance: { usedVotes: 2, voteLimit: 3 },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/playlist/share");
  });
});
