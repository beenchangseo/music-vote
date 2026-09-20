"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { useDialog } from "./DialogProvider";
import {
  getVotingSettings,
  saveVotingSettings,
  type VotingSettings,
} from "@/actions/member";
import { deletePlaylist, resetPlaylistVotes, updateSetlistEditMode } from "@/actions/playlist";
import type { SetlistEditMode, VotingMode } from "@/lib/types";

interface Props {
  playlistId: string;
  shareCode: string;
  adminToken: string | null;
  supportsVoteAllocation: boolean;
  currentUserId?: string | null;
  onAllowanceChange?: (mode: VotingMode, usedVotes: number, voteLimit: number) => void;
  onVotesAnonymousChange?: (votesAnonymous: boolean) => void;
  onVotesReset?: () => void;
  setlistEditMode: SetlistEditMode;
  onSetlistEditModeChange: (mode: SetlistEditMode) => void;
}

export default function RoomSettingsButton({
  playlistId,
  shareCode,
  adminToken,
  supportsVoteAllocation,
  currentUserId,
  onAllowanceChange,
  onVotesAnonymousChange,
  onVotesReset,
  setlistEditMode,
  onSetlistEditModeChange,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<VotingSettings | null>(null);
  const [mode, setMode] = useState<VotingMode>("free");
  const [votesAnonymous, setVotesAnonymous] = useState(true);
  const [defaultLimit, setDefaultLimit] = useState(3);
  const [memberLimits, setMemberLimits] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const { showAlert, showConfirm, showDanger } = useDialog();

  async function load() {
    setOpen(true);
    try {
      const next = await getVotingSettings(playlistId, adminToken);
      setSettings(next);
      setMode(next.mode);
      setVotesAnonymous(next.votesAnonymous);
      setDefaultLimit(next.defaultVoteLimit);
      setMemberLimits(Object.fromEntries(next.members.map((member) => [member.user_id, String(member.vote_limit)])));
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "투표 설정을 불러오지 못했습니다.");
      setOpen(false);
    }
  }

  function refresh() {
    return getVotingSettings(playlistId, adminToken).then((next) => {
      setSettings(next);
      setMode(next.mode);
      setVotesAnonymous(next.votesAnonymous);
      setDefaultLimit(next.defaultVoteLimit);
      setMemberLimits(Object.fromEntries(next.members.map((member) => [member.user_id, String(member.vote_limit)])));
      const me = next.members.find((member) => member.user_id === currentUserId);
      if (me) onAllowanceChange?.(next.mode, me.used_votes, me.vote_limit);
    });
  }

  /** 서버가 들고 있는 참여자별 투표권. 입력 중인 값으로 덮어쓰지 않기 위해 쓴다. */
  function savedMemberLimits() {
    return (settings?.members ?? []).map((member) => ({
      userId: member.user_id,
      voteLimit: member.vote_limit,
    }));
  }

  /**
   * 토글은 누르는 즉시 저장한다.
   * 종전에는 모달 한가운데에 `설정 저장` 이 있었는데, 위아래 모두 토글이라
   * 무엇이 저장 대상인지 읽히지 않았다. 입력칸이 있는 투표권 블록만 자체 저장을 남긴다.
   */
  function persist(next: { votesAnonymous?: boolean; mode?: VotingMode }) {
    const nextAnonymous = next.votesAnonymous ?? votesAnonymous;
    const nextMode = next.mode ?? mode;
    const previousAnonymous = votesAnonymous;
    const previousMode = mode;

    setVotesAnonymous(nextAnonymous);
    setMode(nextMode);

    startTransition(async () => {
      try {
        await saveVotingSettings(
          playlistId,
          adminToken,
          nextAnonymous,
          nextMode,
          defaultLimit,
          savedMemberLimits(),
          shareCode,
        );
        onVotesAnonymousChange?.(nextAnonymous);
        await refresh();
        router.refresh();
      } catch (error) {
        setVotesAnonymous(previousAnonymous);
        setMode(previousMode);
        showAlert(error instanceof Error ? error.message : "투표 설정 변경에 실패했습니다.");
      }
    });
  }

  async function changeVoteVisibility(next: boolean) {
    if (next === votesAnonymous) return;
    if (!next) {
      const ok = await showConfirm(
        "투표한 멤버 닉네임이 모두에게 보이게 됩니다.\n계속할까요?",
        "기명 투표로 전환",
      );
      if (!ok) return;
    }
    persist({ votesAnonymous: next });
  }

  // 셋리스트 편집 권한도 투표 설정과 같이 누르는 즉시 적용된다.
  function changeSetlistEditMode(next: SetlistEditMode) {
    const previous = setlistEditMode;
    onSetlistEditModeChange(next);
    startTransition(async () => {
      try {
        await updateSetlistEditMode(playlistId, adminToken, next, shareCode);
      } catch (error) {
        onSetlistEditModeChange(previous);
        showAlert(error instanceof Error ? error.message : "편집 권한 변경에 실패했습니다.");
      }
    });
  }

  async function removeRoom() {
    const ok = await showDanger(
      "합주방과 모든 곡·투표·셋리스트가 삭제되며 되돌릴 수 없어요.\n삭제할까요?",
      "합주방 삭제",
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await deletePlaylist(playlistId, adminToken);
        let stored = JSON.parse(localStorage.getItem("myPlaylists") || "[]");
        if (!Array.isArray(stored)) stored = [];
        const updated = stored.filter((item: { id: string }) => item.id !== playlistId);
        try { localStorage.setItem("myPlaylists", JSON.stringify(updated)); } catch { /* quota */ }
        router.push("/");
      } catch {
        showAlert("삭제에 실패했습니다.");
      }
    });
  }

  async function resetVotes() {
    const ok = await showConfirm(
      `현재 ${settings?.totalVotes ?? 0}개의 찬성·반대 투표가 모두 삭제되며 되돌릴 수 없어요.\n초기화할까요?`,
      "모든 투표 초기화",
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await resetPlaylistVotes(playlistId, adminToken, shareCode);
        await refresh();
        onVotesReset?.();
        router.refresh();
        showAlert("모든 투표를 초기화했어요.");
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "투표 초기화에 실패했습니다.");
      }
    });
  }

  function saveConfiguration() {
    if (!Number.isInteger(defaultLimit) || defaultLimit < 1 || defaultLimit > 99) {
      showAlert("기본 투표권은 1~99개여야 합니다.");
      return;
    }

    const nextMemberLimits = settings?.members.map((member) => ({
      userId: member.user_id,
      voteLimit: mode === "allocated"
        ? Number(memberLimits[member.user_id])
        : member.vote_limit,
      usedVotes: member.used_votes,
      displayName: member.display_name,
    })) ?? [];
    const invalid = nextMemberLimits.find(({ voteLimit }) => (
      !Number.isInteger(voteLimit) || voteLimit < 0 || voteLimit > 99
    ));
    if (invalid) {
      showAlert(`${invalid.displayName}님의 투표권은 0~99개 정수여야 합니다.`);
      return;
    }
    const belowUsage = nextMemberLimits.find(({ voteLimit, usedVotes }) => voteLimit < usedVotes);
    if (belowUsage) {
      showAlert(`${belowUsage.displayName}님이 이미 ${belowUsage.usedVotes}표를 사용 중이라 ${belowUsage.voteLimit}표로 줄일 수 없습니다.`);
      return;
    }

    startTransition(async () => {
      try {
        await saveVotingSettings(
          playlistId,
          adminToken,
          votesAnonymous,
          mode,
          defaultLimit,
          nextMemberLimits.map(({ userId, voteLimit }) => ({ userId, voteLimit })),
          shareCode,
        );
        onVotesAnonymousChange?.(votesAnonymous);
        await refresh();
        router.refresh();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "투표 설정 변경에 실패했습니다.");
      }
    });
  }

  function changeMember(userId: string, nextLimit: number) {
    if (!Number.isInteger(nextLimit) || nextLimit < 0 || nextLimit > 99) return;
    setMemberLimits((current) => ({ ...current, [userId]: String(nextLimit) }));
  }

  async function applyAll() {
    if (!Number.isInteger(defaultLimit) || defaultLimit < 1 || defaultLimit > 99) {
      showAlert("기본 투표권은 1~99개여야 합니다.");
      return;
    }
    const ok = await showConfirm(
      `참여자별 입력값을 모두 ${defaultLimit}표로 맞출까요?\n설정 저장 전까지는 반영되지 않아요.`,
      "전체 입력값 변경",
    );
    if (!ok) return;
    const blocked = settings?.members.find((member) => member.used_votes > defaultLimit);
    if (blocked) {
      showAlert(`${blocked.display_name}님이 이미 ${blocked.used_votes}표를 사용 중이라 ${defaultLimit}표를 적용할 수 없습니다.`);
      return;
    }
    setMemberLimits(Object.fromEntries((settings?.members ?? []).map((member) => [member.user_id, String(defaultLimit)])));
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-transparent text-text-muted transition-all hover:bg-surface-hover hover:text-text active:scale-95"
        aria-label="방 설정"
        title="방 설정"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.197.717.258 1.07.124l1.205-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-.992.826a1.125 1.125 0 00-.4 1.016v.264c-.006.38.137.751.4 1.016l.992.826c.423.35.534.956.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.205-.456a1.125 1.125 0 00-1.07.124 6.57 6.57 0 01-.22.127 1.125 1.125 0 00-.645.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.592c-.55 0-1.02-.398-1.11-.94l-.213-1.281a1.125 1.125 0 00-.645-.87 6.52 6.52 0 01-.22-.127 1.125 1.125 0 00-1.07-.124l-1.205.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l.992-.826a1.125 1.125 0 00.4-1.016v-.264a1.125 1.125 0 00-.4-1.016l-.992-.826a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.205.456c.353.134.746.073 1.07-.124.072-.044.146-.087.22-.127.332-.184.582-.496.645-.87l.213-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="방 설정">
        {!settings ? (
          <div className="py-10 text-center text-sm text-text-muted">불러오는 중...</div>
        ) : (
          <div className={isPending ? "pointer-events-none opacity-70" : ""}>
            <section>
              <p className="text-caption font-semibold uppercase tracking-wider text-text-subtle">투표 · 공개 범위</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => changeVoteVisibility(true)}
                  aria-pressed={votesAnonymous}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    votesAnonymous
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-surface text-text-muted"
                  }`}
                >
                  익명 투표
                </button>
                <button
                  type="button"
                  onClick={() => changeVoteVisibility(false)}
                  aria-pressed={!votesAnonymous}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    !votesAnonymous
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-surface text-text-muted"
                  }`}
                >
                  기명 투표
                </button>
              </div>
              <p className="mt-2 text-caption text-text-muted">
                {votesAnonymous
                  ? "누가 어떻게 투표했는지 다른 참여자에게 보이지 않아요."
                  : "투표한 멤버의 닉네임이 모든 참여자에게 보여요."}
              </p>
            </section>

            {supportsVoteAllocation && (
              <section className="mt-6 border-t border-border pt-5">
                <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-text-subtle">투표 · 방식</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["free", "allocated"] as VotingMode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={settings.totalVotes > 0 && value !== settings.mode}
                      onClick={() => value !== mode && persist({ mode: value })}
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
                          inputMode="numeric"
                          value={defaultLimit}
                          onChange={(e) => setDefaultLimit(Number(e.target.value))}
                          className="h-11 w-20 rounded-xl border border-border bg-surface-hover px-2 text-center text-text"
                          aria-label="새 참여자 기본 투표권"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={applyAll}
                        className="mt-3 min-h-11 w-full rounded-xl border border-border bg-surface-hover text-sm font-semibold text-text-muted"
                      >
                        모두에게 적용
                      </button>
                    </div>

                    <div className="mt-5 space-y-2">
                      <p className="text-caption font-semibold uppercase tracking-wider text-text-subtle">참여자별 투표권</p>
                      {settings.members.map((member) => {
                        const stagedLimit = Number(memberLimits[member.user_id]);
                        return (
                          <div key={member.user_id} className="rounded-xl border border-border bg-surface p-3">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-text">{member.display_name}</p>
                                <p className="text-caption text-text-muted">{member.used_votes}표 사용</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => changeMember(member.user_id, stagedLimit - 1)}
                                disabled={!Number.isInteger(stagedLimit) || stagedLimit <= member.used_votes}
                                className="h-11 w-11 shrink-0 rounded-xl border border-border text-text-muted disabled:opacity-30"
                                aria-label={`${member.display_name} 투표권 줄이기`}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={member.used_votes}
                                max={99}
                                step={1}
                                inputMode="numeric"
                                value={memberLimits[member.user_id] ?? ""}
                                onChange={(event) => setMemberLimits((current) => ({
                                  ...current,
                                  [member.user_id]: event.target.value,
                                }))}
                                className="h-11 w-16 shrink-0 rounded-xl border border-border bg-surface-hover px-1 text-center text-sm font-bold tabular-nums text-text"
                                aria-label={`${member.display_name} 투표권 직접 입력`}
                              />
                              <button
                                type="button"
                                onClick={() => changeMember(member.user_id, stagedLimit + 1)}
                                disabled={!Number.isInteger(stagedLimit) || stagedLimit >= 99}
                                className="h-11 w-11 shrink-0 rounded-xl border border-border text-text-muted disabled:opacity-30"
                                aria-label={`${member.display_name} 투표권 늘리기`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {/* 숫자 입력이라 즉시 적용이 안 된다. 이 블록만 저장을 남긴다. */}
                      <Button type="button" fullWidth onClick={saveConfiguration} loading={isPending} className="mt-3">
                        투표권 저장
                      </Button>
                    </div>
                  </>
                )}
              </section>
            )}

            <section className="mt-6 border-t border-border pt-5">
              <p className="text-caption font-semibold uppercase tracking-wider text-text-subtle">셋리스트 · 편집 권한</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  { value: "everyone" as SetlistEditMode, label: "모두 편집" },
                  { value: "host_only" as SetlistEditMode, label: "방장만 편집" },
                ]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={isPending}
                    onClick={() => value !== setlistEditMode && changeSetlistEditMode(value)}
                    aria-pressed={setlistEditMode === value}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                      setlistEditMode === value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-surface text-text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-caption text-text-muted">
                {setlistEditMode === "everyone"
                  ? "참여자 누구나 곡을 추가·수정하고 순서를 바꿀 수 있어요."
                  : "방장만 셋리스트를 바꿀 수 있어요."}
              </p>
            </section>

            <section className="mt-6 border-t border-border pt-5">
              <p className="text-caption font-semibold uppercase tracking-wider text-text-subtle">투표 초기화</p>
              <p className="mt-1 text-caption leading-relaxed text-text-muted">
                모든 참여자의 찬성·반대 투표를 삭제해요. 곡과 참여자 정보는 유지돼요.
              </p>
              <Button
                type="button"
                variant="danger"
                fullWidth
                disabled={settings.totalVotes === 0}
                onClick={resetVotes}
                className="mt-3"
              >
                {settings.totalVotes > 0 ? `모든 투표 초기화 (${settings.totalVotes}개)` : "초기화할 투표가 없어요"}
              </Button>
            </section>

            {/* 되돌릴 수 없는 동작이다. 헤더에서 한 번 눌리던 자리에 두지 않는다. */}
            <section className="mt-6 border-t border-border pt-5">
              <p className="text-caption font-semibold uppercase tracking-wider text-text-subtle">합주방 삭제</p>
              <p className="mt-1 text-caption leading-relaxed text-text-muted">
                곡·투표·셋리스트·코멘트가 모두 사라져요. 되돌릴 수 없어요.
              </p>
              <Button type="button" variant="danger" fullWidth onClick={removeRoom} className="mt-3">
                합주방 삭제
              </Button>
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
