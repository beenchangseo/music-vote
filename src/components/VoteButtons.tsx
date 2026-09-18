"use client";

import { useState, useTransition } from "react";
import { castVote } from "@/actions/vote";
import { track } from "@/lib/analytics";
import { triggerKakaoLogin } from "@/lib/kakao-login";
import { useDialog } from "./DialogProvider";
import { applyVotePress, type VoteDirection } from "@/lib/vote-domain";
import type { VoteAllowance, VotingMode } from "@/lib/types";

const VOTE_LIMIT_REACHED_MESSAGE =
  "투표권을 모두 사용했어요. 기존 표를 취소하면 다시 투표할 수 있어요.";

interface VoteButtonsProps {
  songId: string;
  score: number;
  userVote: number | null;
  userVoteCount: number;
  votingMode: VotingMode;
  allowance?: VoteAllowance | null;
  nickname: string;
  shareCode: string;
  onVoteOptimistic?: (songId: string, scoreDelta: number) => void;
  disabled?: boolean;
  /** 로그인 필수 모드 + 비로그인 → 클릭 시 카카오 OAuth. */
  loginGate?: boolean;
  onAllowanceChange?: (usedVotes: number, voteLimit: number) => void;
}

export default function VoteButtons({
  songId,
  score,
  userVote,
  userVoteCount,
  votingMode,
  allowance = null,
  nickname,
  shareCode,
  onVoteOptimistic,
  disabled: disabledProp = false,
  loginGate = false,
  onAllowanceChange,
}: VoteButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [localUserVote, setLocalUserVote] = useState<VoteDirection | null>(
    userVote === 1 || userVote === -1 ? userVote : null,
  );
  const [localUserVoteCount, setLocalUserVoteCount] = useState(userVoteCount);
  const { showAlert } = useDialog();

  function handleVote(voteType: number) {
    if (loginGate) {
      triggerKakaoLogin();
      return;
    }
    if (!nickname || isPending || disabledProp) return;

    if (voteType !== 1 && voteType !== -1) return;
    const direction = voteType as VoteDirection;
    const previousVote = localUserVote;
    const previousCount = localUserVoteCount;
    const next = applyVotePress(
      { direction: localUserVote, count: localUserVoteCount },
      direction,
      votingMode,
    );

    const allowanceExhausted = allowance?.mode === "allocated"
      && allowance.usedVotes >= allowance.voteLimit;
    if (allowanceExhausted && next.usageDelta > 0) {
      showAlert(VOTE_LIMIT_REACHED_MESSAGE);
      return;
    }

    setLocalUserVote(next.direction);
    setLocalUserVoteCount(next.count);
    if (next.action === "changed" && previousVote !== null) {
      track("vote_changed", {
        from: previousVote,
        to: direction,
      });
    } else if (next.action === "removed") {
      track("vote_toggled", { vote_type: previousVote ?? direction });
    } else {
      track("vote_cast", { vote_type: direction });
    }

    // Notify parent for instant sort + score display
    onVoteOptimistic?.(songId, next.scoreDelta);

    startTransition(async () => {
      const rollback = () => {
        setLocalUserVote(previousVote);
        setLocalUserVoteCount(previousCount);
        onVoteOptimistic?.(songId, -next.scoreDelta);
      };

      try {
        const result = await castVote(songId, nickname, voteType, shareCode);
        if (!result.success) {
          rollback();
          if (result.reason === "vote_limit_reached") {
            showAlert(VOTE_LIMIT_REACHED_MESSAGE);
          }
          return;
        }
        if (result.allowance) {
          onAllowanceChange?.(result.allowance.usedVotes, result.allowance.voteLimit);
        }
      } catch {
        rollback();
        showAlert("투표에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={(!nickname && !loginGate) || disabledProp || isPending}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-60 ${
          localUserVote === 1
            ? "text-upvote bg-upvote/10"
            : "text-text-muted hover:text-upvote hover:bg-upvote/5"
        }`}
        aria-label={votingMode === "allocated" && localUserVote === -1 ? "반대표 한 개 취소" : "찬성표 추가"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
        {votingMode === "allocated" && localUserVote === 1 && localUserVoteCount > 0 && (
          <VoteCountBadge count={localUserVoteCount} />
        )}
      </button>

      <span
        className={`min-w-[2rem] text-center font-bold text-lg tabular-nums ${
          score > 0
            ? "text-upvote"
            : score < 0
            ? "text-downvote"
            : "text-text-muted"
        }`}
      >
        {score}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={(!nickname && !loginGate) || disabledProp || isPending}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-60 ${
          localUserVote === -1
            ? "text-downvote bg-downvote/10"
            : "text-text-muted hover:text-downvote hover:bg-downvote/5"
        }`}
        aria-label={votingMode === "allocated" && localUserVote === 1 ? "찬성표 한 개 취소" : "반대표 추가"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        {votingMode === "allocated" && localUserVote === -1 && localUserVoteCount > 0 && (
          <VoteCountBadge count={localUserVoteCount} />
        )}
      </button>
    </div>
  );
}

function VoteCountBadge({ count }: { count: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-white tabular-nums">
      {count}
    </span>
  );
}
