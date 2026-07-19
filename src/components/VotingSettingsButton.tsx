"use client";

import { useState, useTransition } from "react";
import Modal from "./ui/Modal";
import { useDialog } from "./DialogProvider";
import {
  applyVoteLimitToAll,
  configureVoting,
  getVotingSettings,
  updateMemberVoteLimit,
  type VotingSettings,
} from "@/actions/member";
import type { VotingMode } from "@/lib/types";

interface Props {
  playlistId: string;
  shareCode: string;
  adminToken: string | null;
  currentUserId?: string | null;
  onAllowanceChange?: (mode: VotingMode, usedVotes: number, voteLimit: number) => void;
}

export default function VotingSettingsButton({ playlistId, shareCode, adminToken, currentUserId, onAllowanceChange }: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<VotingSettings | null>(null);
  const [mode, setMode] = useState<VotingMode>("free");
  const [defaultLimit, setDefaultLimit] = useState(3);
  const [isPending, startTransition] = useTransition();
  const { showAlert, showConfirm } = useDialog();

  async function load() {
    setOpen(true);
    try {
      const next = await getVotingSettings(playlistId, adminToken);
      setSettings(next);
      setMode(next.mode);
      setDefaultLimit(next.defaultVoteLimit);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "투표 설정을 불러오지 못했습니다.");
      setOpen(false);
    }
  }

  function refresh() {
    return getVotingSettings(playlistId, adminToken).then((next) => {
      setSettings(next);
      setMode(next.mode);
      setDefaultLimit(next.defaultVoteLimit);
      const me = next.members.find((member) => member.user_id === currentUserId);
      if (me) onAllowanceChange?.(next.mode, me.used_votes, me.vote_limit);
    });
  }

  function saveConfiguration() {
    if (!Number.isInteger(defaultLimit) || defaultLimit < 1 || defaultLimit > 99) {
      showAlert("기본 투표권은 1~99개여야 합니다.");
      return;
    }
    startTransition(async () => {
      try {
        await configureVoting(playlistId, mode, defaultLimit, shareCode);
        await refresh();
        setOpen(false);
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "투표 설정 변경에 실패했습니다.");
      }
    });
  }

  function changeMember(userId: string, nextLimit: number) {
    if (nextLimit < 0 || nextLimit > 99) return;
    startTransition(async () => {
      try {
        await updateMemberVoteLimit(playlistId, userId, nextLimit, shareCode);
        await refresh();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "투표권 변경에 실패했습니다.");
      }
    });
  }

  async function applyAll() {
    const ok = await showConfirm(
      `현재 참여자 모두에게 ${defaultLimit}표를 적용할까요?`,
      "전체 참여자에게 적용",
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await applyVoteLimitToAll(playlistId, defaultLimit, shareCode);
        await refresh();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "일괄 변경에 실패했습니다.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-hover text-text-muted transition-colors hover:text-text"
        aria-label="투표 설정"
        title="투표 설정"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.197.717.258 1.07.124l1.205-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-.992.826a1.125 1.125 0 00-.4 1.016v.264c-.006.38.137.751.4 1.016l.992.826c.423.35.534.956.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.205-.456a1.125 1.125 0 00-1.07.124 6.57 6.57 0 01-.22.127 1.125 1.125 0 00-.645.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.592c-.55 0-1.02-.398-1.11-.94l-.213-1.281a1.125 1.125 0 00-.645-.87 6.52 6.52 0 01-.22-.127 1.125 1.125 0 00-1.07-.124l-1.205.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l.992-.826a1.125 1.125 0 00.4-1.016v-.264a1.125 1.125 0 00-.4-1.016l-.992-.826a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.205.456c.353.134.746.073 1.07-.124.072-.044.146-.087.22-.127.332-.184.582-.496.645-.87l.213-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="투표 설정">
        {!settings ? (
          <div className="py-10 text-center text-sm text-text-muted">불러오는 중...</div>
        ) : (
          <div className={isPending ? "pointer-events-none opacity-70" : ""}>
            <div className="grid grid-cols-2 gap-2">
              {(["free", "allocated"] as VotingMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={settings.totalVotes > 0 && value !== settings.mode}
                  onClick={() => setMode(value)}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    mode === value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-surface text-text-muted"
                  }`}
                >
                  {value === "free" ? "자유 투표" : "투표권 할당"}
                </button>
              ))}
            </div>
            {settings.totalVotes > 0 && (
              <p className="mt-2 text-caption text-warning">투표가 시작되어 모드는 바꿀 수 없어요.</p>
            )}

            {mode === "allocated" && (
              <>
                <div className="mt-5 rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">새 참여자 기본 투표권</p>
                      <p className="text-caption text-text-muted">
                        {settings.mode === "allocated" ? "기존 참여자 값은 유지돼요." : "전환하면 현재 참여자에게도 적용돼요."}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      step={1}
                      value={defaultLimit}
                      onChange={(e) => setDefaultLimit(Number(e.target.value))}
                      className="h-11 w-20 rounded-xl border border-border bg-surface-hover px-2 text-center text-text"
                    />
                  </div>
                  <div className={`mt-3 grid gap-2 ${settings.mode === "allocated" ? "grid-cols-2" : "grid-cols-1"}`}>
                    <button type="button" onClick={saveConfiguration} className="min-h-11 rounded-xl bg-primary text-sm font-semibold text-white">
                      설정 저장
                    </button>
                    {settings.mode === "allocated" && (
                      <button type="button" onClick={applyAll} className="min-h-11 rounded-xl border border-border bg-surface-hover text-sm font-semibold text-text-muted">
                        모두에게 적용
                      </button>
                    )}
                  </div>
                </div>

                {settings.mode === "allocated" && <div className="mt-5 space-y-2">
                  <p className="text-caption font-semibold uppercase tracking-wider text-text-subtle">참여자</p>
                  {settings.members.map((member) => (
                    <div key={member.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{member.display_name}</p>
                        <p className="text-caption text-text-muted">{member.vote_limit}표 중 {member.used_votes}표 사용</p>
                      </div>
                      <button type="button" onClick={() => changeMember(member.user_id, member.vote_limit - 1)} disabled={member.vote_limit <= 0 || member.vote_limit <= member.used_votes} className="h-11 w-11 rounded-xl border border-border text-text-muted disabled:opacity-30" aria-label={`${member.display_name} 투표권 줄이기`}>−</button>
                      <span className="w-7 text-center text-sm font-bold tabular-nums text-text">{member.vote_limit}</span>
                      <button type="button" onClick={() => changeMember(member.user_id, member.vote_limit + 1)} disabled={member.vote_limit >= 99} className="h-11 w-11 rounded-xl border border-border text-text-muted disabled:opacity-30" aria-label={`${member.display_name} 투표권 늘리기`}>+</button>
                    </div>
                  ))}
                </div>}
              </>
            )}

            {mode === "free" && (
              <button type="button" onClick={saveConfiguration} className="mt-5 min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white">
                설정 저장
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
