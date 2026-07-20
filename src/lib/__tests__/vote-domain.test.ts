import { describe, expect, it } from "vitest";
import {
  applyVotePress,
  canReduceVoteLimit,
  isValidDefaultVoteLimit,
  remainingVotes,
} from "../vote-domain";

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

  it("adds repeated votes on one song in allocated mode", () => {
    expect(applyVotePress({ direction: 1, count: 2 }, 1, "allocated")).toEqual({
      direction: 1,
      count: 3,
      scoreDelta: 1,
      usageDelta: 1,
      action: "added",
    });
  });

  it("cancels repeated votes one at a time with the opposite arrow", () => {
    expect(applyVotePress({ direction: 1, count: 3 }, -1, "allocated")).toEqual({
      direction: 1,
      count: 2,
      scoreDelta: -1,
      usageDelta: -1,
      action: "removed",
    });
    expect(applyVotePress({ direction: 1, count: 1 }, -1, "allocated")).toEqual({
      direction: null,
      count: 0,
      scoreDelta: -1,
      usageDelta: -1,
      action: "removed",
    });
    expect(applyVotePress({ direction: null, count: 0 }, -1, "allocated")).toEqual({
      direction: -1,
      count: 1,
      scoreDelta: -1,
      usageDelta: 1,
      action: "added",
    });
  });

  it("keeps the existing toggle behavior in free mode", () => {
    expect(applyVotePress({ direction: 1, count: 1 }, 1, "free")).toEqual({
      direction: null,
      count: 0,
      scoreDelta: -1,
      usageDelta: -1,
      action: "removed",
    });
  });
});
