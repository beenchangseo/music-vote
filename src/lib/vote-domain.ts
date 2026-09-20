import type { VoteAllowance, VotingMode } from "./types";

export type VoteDirection = 1 | -1;

interface UserSongVoteState {
  direction: VoteDirection | null;
  count: number;
}

export interface VotePressResult extends UserSongVoteState {
  scoreDelta: number;
  usageDelta: 1 | 0 | -1;
  action: "added" | "removed" | "changed";
}

export function applyVotePress(
  current: UserSongVoteState,
  pressed: VoteDirection,
  mode: VotingMode,
): VotePressResult {
  if (mode === "allocated") {
    if (current.direction !== null && current.direction !== pressed && current.count > 0) {
      const nextCount = current.count - 1;
      return {
        direction: nextCount === 0 ? null : current.direction,
        count: nextCount,
        scoreDelta: pressed,
        usageDelta: -1,
        action: "removed",
      };
    }

    return {
      direction: pressed,
      count: current.count + 1,
      scoreDelta: pressed,
      usageDelta: 1,
      action: "added",
    };
  }

  if (current.direction === pressed) {
    return {
      direction: null,
      count: 0,
      scoreDelta: -pressed,
      usageDelta: -1,
      action: "removed",
    };
  }
  if (current.direction !== null) {
    return {
      direction: pressed,
      count: 1,
      scoreDelta: pressed * 2,
      usageDelta: 0,
      action: "changed",
    };
  }
  return {
    direction: pressed,
    count: 1,
    scoreDelta: pressed,
    usageDelta: 1,
    action: "added",
  };
}

export function remainingVotes(allowance: VoteAllowance): number | null {
  if (allowance.mode === "free") return null;
  return Math.max(0, allowance.voteLimit - allowance.usedVotes);
}

export function canReduceVoteLimit(usedVotes: number, nextLimit: number): boolean {
  return Number.isInteger(nextLimit) && nextLimit >= usedVotes && nextLimit <= 99;
}

export function isValidDefaultVoteLimit(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 99;
}

/**
 * 투표자 닉네임을 화면으로 내려보낼지 정한다.
 * 익명 모드는 화면에서 가리는 데 그치지 않고 페이로드에서도 빼야 한다.
 */
export function shouldExposeVoters(playlist: { votes_anonymous: boolean }): boolean {
  return !playlist.votes_anonymous;
}

/**
 * 점수순으로 정렬된 목록에 순위를 매긴다.
 * 같은 점수는 같은 등수이고, 그 다음 등수는 건너뛴다. (5,5,4 → 1,1,3)
 *
 * 화면은 1~3위만 번호를 보여준다. 34곡에 전부 번호를 달면 번호가 소음이 된다.
 */
export function assignRanks(scores: number[]): number[] {
  let lastScore: number | null = null;
  let lastRank = 0;
  return scores.map((score, index) => {
    if (score !== lastScore) {
      lastRank = index + 1;
      lastScore = score;
    }
    return lastRank;
  });
}

/** 최고점 대비 비율(0~1). 점수가 숫자로만 있으면 박빙인지 압도적인지 안 읽힌다. */
export function scoreRatio(score: number, topScore: number): number {
  if (topScore <= 0) return 0;
  return Math.max(0, Math.min(1, score / topScore));
}
