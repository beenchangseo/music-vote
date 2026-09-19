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
