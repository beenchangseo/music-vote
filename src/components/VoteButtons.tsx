"use client";

import { useState, useEffect, useTransition } from "react";
import { castVote } from "@/actions/vote";
import { track } from "@/lib/analytics";

interface VoteButtonsProps {
  songId: string;
  score: number;
  userVote: number | null;
  nickname: string;
  shareCode: string;
  onVoteOptimistic?: (songId: string, scoreDelta: number) => void;
  disabled?: boolean;
}

export default function VoteButtons({
  songId,
  score,
  userVote,
  nickname,
  shareCode,
  onVoteOptimistic,
  disabled: disabledProp = false,
}: VoteButtonsProps) {
  const [isPending, startTransition] = useTransition();
  // Only track userVote locally for button highlight
  const [localUserVote, setLocalUserVote] = useState(userVote);

  // Sync with server state when props change (after revalidation)
  useEffect(() => {
    setLocalUserVote(userVote);
  }, [userVote]);

  function handleVote(voteType: number) {
    if (!nickname || isPending || disabledProp) return;

    // Calculate score delta
    let scoreDelta: number;
    if (localUserVote === voteType) {
      // Toggle off
      scoreDelta = -voteType;
      setLocalUserVote(null);
      track("vote_toggled", { vote_type: voteType as 1 | -1 });
    } else if (localUserVote !== null) {
      // Change direction
      scoreDelta = voteType * 2;
      setLocalUserVote(voteType);
      track("vote_changed", {
        from: localUserVote as 1 | -1,
        to: voteType as 1 | -1,
      });
    } else {
      // New vote
      scoreDelta = voteType;
      setLocalUserVote(voteType);
      track("vote_cast", { vote_type: voteType as 1 | -1 });
    }

    // Notify parent for instant sort + score display
    onVoteOptimistic?.(songId, scoreDelta);

    startTransition(async () => {
      await castVote(songId, nickname, voteType, shareCode);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={!nickname || disabledProp}
        className={`p-2.5 rounded-lg transition-all active:scale-90 ${
          localUserVote === 1
            ? "text-upvote bg-upvote/10"
            : "text-text-muted hover:text-upvote hover:bg-upvote/5"
        }`}
        aria-label="업보트"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
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
        disabled={!nickname || disabledProp}
        className={`p-2.5 rounded-lg transition-all active:scale-90 ${
          localUserVote === -1
            ? "text-downvote bg-downvote/10"
            : "text-text-muted hover:text-downvote hover:bg-downvote/5"
        }`}
        aria-label="다운보트"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  );
}
