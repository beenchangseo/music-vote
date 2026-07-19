import type { VoteAllowance } from "./types";

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
