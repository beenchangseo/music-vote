import { describe, expect, it } from "vitest";
import { canReduceVoteLimit, isValidDefaultVoteLimit, remainingVotes } from "../vote-domain";

describe("vote allocation domain", () => {
  it("shows only allocated-mode remaining votes", () => {
    expect(remainingVotes({ mode: "allocated", voteLimit: 5, usedVotes: 2 })).toBe(3);
    expect(remainingVotes({ mode: "free", voteLimit: 5, usedVotes: 2 })).toBeNull();
  });

  it("does not allow a limit below current usage", () => {
    expect(canReduceVoteLimit(3, 2)).toBe(false);
    expect(canReduceVoteLimit(3, 3)).toBe(true);
  });

  it("accepts only integer defaults from 1 through 99", () => {
    expect(isValidDefaultVoteLimit(1)).toBe(true);
    expect(isValidDefaultVoteLimit(99)).toBe(true);
    expect(isValidDefaultVoteLimit(0)).toBe(false);
    expect(isValidDefaultVoteLimit(1.5)).toBe(false);
  });
});
