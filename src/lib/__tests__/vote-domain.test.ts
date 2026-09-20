import { describe, expect, it } from "vitest";
import {
  applyVotePress,
  canReduceVoteLimit,
  isValidDefaultVoteLimit,
  assignRanks,
  remainingVotes,
  scoreRatio,
  shouldExposeVoters,
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

describe("shouldExposeVoters", () => {
  it("hides voter nicknames while the room is anonymous", () => {
    expect(shouldExposeVoters({ votes_anonymous: true })).toBe(false);
  });

  it("shows voter nicknames once the host turns on named voting", () => {
    expect(shouldExposeVoters({ votes_anonymous: false })).toBe(true);
  });
});

describe("assignRanks", () => {
  it("같은 점수는 같은 등수를 받고 다음 등수는 건너뛴다", () => {
    expect(assignRanks([5, 5, 4, 3, 3, 3, 1])).toEqual([1, 1, 3, 4, 4, 4, 7]);
  });

  it("동점이 없으면 순서대로 매긴다", () => {
    expect(assignRanks([9, 7, 4])).toEqual([1, 2, 3]);
  });

  it("전부 같으면 모두 1등이다", () => {
    expect(assignRanks([0, 0, 0])).toEqual([1, 1, 1]);
  });

  it("빈 목록을 견딘다", () => {
    expect(assignRanks([])).toEqual([]);
  });
});

describe("scoreRatio", () => {
  it("최고점 대비 비율을 돌려준다", () => {
    expect(scoreRatio(5, 5)).toBe(1);
    expect(scoreRatio(2, 4)).toBe(0.5);
  });

  it("음수 점수와 0점 기준을 견딘다", () => {
    expect(scoreRatio(-3, 5)).toBe(0);
    expect(scoreRatio(3, 0)).toBe(0);
  });
});
