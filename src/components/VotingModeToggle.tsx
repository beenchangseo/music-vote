"use client";

import { useState, useTransition } from "react";
import { useDialog } from "./DialogProvider";
import { updateVotingMode } from "@/actions/playlist";

interface VotingModeToggleProps {
  playlistId: string;
  shareCode: string;
  adminToken: string;
  votesAnonymous: boolean;
}

export default function VotingModeToggle({
  playlistId,
  shareCode,
  adminToken,
  votesAnonymous,
}: VotingModeToggleProps) {
  const [optimistic, setOptimistic] = useState(votesAnonymous);
  const [isPending, startTransition] = useTransition();
  const { showAlert, showConfirm } = useDialog();

  async function toggle() {
    const next = !optimistic;

    // 익명 → 기명 전환 시 한 번 확인 (개인정보 노출 신호)
    if (!next) {
      const ok = await showConfirm(
        "투표한 멤버 닉네임이 모두에게 보이게 됩니다.\n계속할까요?",
        "기명 투표로 전환",
      );
      if (!ok) return;
    }

    setOptimistic(next);
    startTransition(async () => {
      try {
        await updateVotingMode(playlistId, adminToken, next, shareCode);
      } catch {
        setOptimistic(!next); // rollback
        showAlert("변경에 실패했습니다.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={!optimistic}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-caption font-semibold transition-colors ${
        optimistic
          ? "bg-surface-hover text-text-muted hover:text-text"
          : "bg-primary/15 text-primary border border-primary/40"
      } ${isPending ? "opacity-60" : ""}`}
      title={
        optimistic
          ? "익명 투표 — 누가 어떻게 투표했는지 비공개"
          : "기명 투표 — 누가 어떻게 투표했는지 모두에게 공개"
      }
    >
      {optimistic ? <LockIcon /> : <EyeIcon />}
      <span>{optimistic ? "익명 투표" : "기명 투표"}</span>
    </button>
  );
}

function LockIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
