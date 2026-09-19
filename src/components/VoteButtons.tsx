"use client";

import { triggerKakaoLogin } from "@/lib/kakao-login";
import type { VoteDirection } from "@/lib/vote-domain";
import type { VotingMode } from "@/lib/types";

interface VoteButtonsProps {
  score: number;
  userVote: number | null;
  userVoteCount: number;
  votingMode: VotingMode;
  onPress: (direction: VoteDirection) => void;
  /** 마감·미입력 닉네임처럼 투표 자체가 막힌 상태. */
  disabled?: boolean;
  /** 이 곡의 투표 요청이 서버 응답을 기다리는 중. */
  pending?: boolean;
  /** 로그인 필수 모드 + 비로그인 → 클릭 시 카카오 OAuth. */
  loginGate?: boolean;
}

/**
 * 점수와 내 표를 화면에 그리기만 한다.
 * 투표 상태와 서버 호출은 usePlaylistVotes 가 소유한다.
 */
export default function VoteButtons({
  score,
  userVote,
  userVoteCount,
  votingMode,
  onPress,
  disabled = false,
  pending = false,
  loginGate = false,
}: VoteButtonsProps) {
  const direction = userVote === 1 || userVote === -1 ? userVote : null;

  function handleClick(pressed: VoteDirection) {
    if (loginGate) {
      triggerKakaoLogin();
      return;
    }
    if (disabled || pending) return;
    onPress(pressed);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleClick(1)}
        disabled={!loginGate && (disabled || pending)}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-60 ${
          direction === 1
            ? "text-upvote bg-upvote/10"
            : "text-text-muted hover:text-upvote hover:bg-upvote/5"
        }`}
        aria-label={votingMode === "allocated" && direction === -1 ? "반대표 한 개 취소" : "찬성표 추가"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
        {votingMode === "allocated" && direction === 1 && userVoteCount > 0 && (
          <VoteCountBadge count={userVoteCount} />
        )}
      </button>

      <span
        role="status"
        aria-label={`점수 ${score}점`}
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
        onClick={() => handleClick(-1)}
        disabled={!loginGate && (disabled || pending)}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-60 ${
          direction === -1
            ? "text-downvote bg-downvote/10"
            : "text-text-muted hover:text-downvote hover:bg-downvote/5"
        }`}
        aria-label={votingMode === "allocated" && direction === 1 ? "찬성표 한 개 취소" : "반대표 추가"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        {votingMode === "allocated" && direction === -1 && userVoteCount > 0 && (
          <VoteCountBadge count={userVoteCount} />
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
