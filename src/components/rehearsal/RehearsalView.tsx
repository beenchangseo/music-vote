"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ScreenToolbar from "../ui/ScreenToolbar";
import Image from "next/image";
import Button from "../ui/Button";
import Card from "../ui/Card";
import ListRow from "../ui/ListRow";
import SongMeta from "./SongMeta";
import CommentSection from "./CommentSection";
import { useDialog } from "../ui/DialogProvider";
import { useMetronome, useTapTempo } from "@/hooks/useMetronome";
import { updateSongMeta } from "@/actions/song";
import { track } from "@/lib/analytics";
import { displayArtist, formatKey } from "@/domain/song-meta";
import { formatRuntime, rehearsalSteps, type RehearsalInterval, type RehearsalStep } from "@/domain/setlist";
import type { SetlistItem, SongWithScore, Comment } from "@/domain/types";

type Step = RehearsalStep<SongWithScore>;

interface RehearsalViewProps {
  setlistItems: SetlistItem[];
  songs: SongWithScore[];
  comments: Comment[];
  playlistId: string;
  shareCode: string;
  nickname: string;
  loading: boolean;
  onCommentsChange: (comments: Comment[]) => void;
  /** 방 설정 버튼. 세 화면 툴바의 같은 자리에 온다. */
  actions?: React.ReactNode;
}

/**
 * 합주 모드는 입력 화면이 아니라 진행 화면이다.
 *
 * 종전에는 곡마다 `+ 메타 추가` 가 달린 카드가 세로로 쌓여 있었고,
 * 프로덕션 셋리스트 12곡 전부 키·BPM 이 비어 있었다. 아무도 쓰지 않았다는 뜻이다.
 * 합주실에서 악기를 들고 볼 때 필요한 건 "지금 몇 번째 곡이고 얼마 남았나"다.
 */
export default function RehearsalView({
  setlistItems,
  songs,
  comments,
  playlistId,
  shareCode,
  nickname,
  loading,
  onCommentsChange,
  actions,
}: RehearsalViewProps) {
  const [selected, setSelected] = useState<{ id: string; index: number } | null>(null);
  const [showMeta, setShowMeta] = useState(false);
  const [showComments, setShowComments] = useState(false);
  // 탭 템포 값. 탭하는 동안과 저장이 끝날 때까지만 서버 값 대신 보인다.
  const [tapped, setTapped] = useState<{ songId: string; bpm: number; saving: boolean } | null>(null);
  const [originalBpm, setOriginalBpm] = useState<Record<string, number>>({});
  const [isSavingBpm, startSavingBpm] = useTransition();
  const { showAlert } = useDialog();

  const { steps, trailing } = useMemo(() => rehearsalSteps(setlistItems, songs), [setlistItems, songs]);
  const found = selected ? steps.findIndex((s) => s.id === selected.id) : -1;
  const step = found >= 0 ? found : Math.min(selected?.index ?? 0, steps.length - 1);
  const current: Step | undefined = steps[step];
  const currentSong = current?.kind === "song" ? current.song : null;
  const { cardRef, nextRef, prevRef, follow } = useFollowCurrentStep(current?.id);

  const pendingBpm = (songId: string) =>
    tapped && tapped.songId === songId && (!tapped.saving || isSavingBpm) ? tapped.bpm : null;
  const bpmOf = (s: Step) =>
    s.kind === "original" ? (originalBpm[s.id] ?? 0) : (pendingBpm(s.song.id) ?? s.song.tempo_bpm ?? 0);
  const tappedBpm = currentSong ? pendingBpm(currentSong.id) : null;
  const bpm = current ? bpmOf(current) : 0;
  const metronome = useMetronome(bpm || 120);

  function keepTappedBpm(target: Step, value: number) {
    if (target.kind === "original") setOriginalBpm((saved) => ({ ...saved, [target.id]: value }));
    else setTapped({ songId: target.song.id, bpm: value, saving: false });
  }

  // 묶음이 끝나면 한 번 저장한다. 실패하면 전환이 끝나면서 서버 값으로 돌아간다.
  function commitTappedBpm(target: Step, value: number, tapCount: number) {
    track("tap_tempo_used", { taps: tapCount });
    if (target.kind === "original") return;
    const { song } = target;
    setTapped({ songId: song.id, bpm: value, saving: true });
    if (song.tempo_bpm === value) return;
    startSavingBpm(async () => {
      try {
        await updateSongMeta(song.id, playlistId, shareCode, { tempoBpm: value });
      } catch {
        showAlert("BPM 을 저장하지 못했어요. 다시 탭해 주세요.");
      }
    });
  }

  if (loading) {
    return (
      <div className="mt-6 py-16 text-center text-text-subtle">
        <span className="inline-block h-8 w-8 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
        <p className="mt-3">합주 정보 불러오는 중...</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mt-6 py-16 text-center text-text-subtle">
        <p className="text-h4 font-medium">합주 모드</p>
        <p className="mt-1 text-sm">셋리스트에 곡을 넣으면 순서대로 진행할 수 있어요</p>
      </div>
    );
  }

  const hasNext = step < steps.length - 1;
  const upNext = steps[step + 1]?.before ?? trailing;
  const songComments = currentSong ? comments.filter((c) => c.song_id === currentSong.id) : [];

  function goTo(target: number, action: "next" | "prev" | "jump") {
    const index = Math.min(steps.length - 1, Math.max(0, target));
    if (metronome.isPlaying && !bpmOf(steps[index])) metronome.stop();
    setSelected({ id: steps[index].id, index });
    follow();
    track("rehearsal_action", { action });
  }

  function openMeta() {
    setShowMeta(true);
    track("rehearsal_action", { action: "meta_open" });
  }

  function toggleMetronome() {
    if (!metronome.isPlaying && !bpm) {
      openMeta();
      return;
    }
    track("rehearsal_action", { action: metronome.isPlaying ? "metronome_off" : "metronome_on" });
    metronome.toggle();
  }

  const chipClass = "inline-flex min-h-11 items-center gap-1.5 rounded-pill px-4 text-sm transition-colors";
  const filledChip = "bg-surface-hover text-text";

  const card = (
    <Card
      ref={cardRef}
      variant="selected"
      padding="sm"
      role="region"
      aria-label="지금 곡"
      aria-current="step"
      className="my-2 scroll-mb-28 scroll-mt-32"
    >
      <div className="flex items-center gap-3">
        <StepCover step={current} size="card" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-primary-fg">지금</p>
          <h2 className="line-clamp-2 break-keep text-h4 font-bold leading-snug text-text">{current.title}</h2>
          <p className="truncate text-sm text-text-muted">
            <StepSubtitle step={current} />
          </p>
        </div>
      </div>

      {/*
        합주실에서 악기 들고 볼 때 필요한 값들.
        비어 있으면 그 자리를 눌러 바로 채운다 — 종전에는 접힌 `키·BPM 적어두기` 를
        펼치고, 그 안의 `메타 추가` 를 또 눌러야 입력칸이 나왔다. 두 번 접혀 있었다.
      */}
      {currentSong ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "우리 키", value: formatKey(currentSong.key_root, currentSong.key_mode) || currentSong.key_memo },
            { label: "BPM", value: bpm ? String(bpm) : null },
            { label: "길이", value: current.duration != null ? formatRuntime(current.duration) : null },
          ].map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={openMeta}
              aria-label={value ? `${label} ${value} 고치기` : `${label} 적어두기`}
              className={`${chipClass} ${
                value
                  ? `${filledChip} hover:bg-surface-elevated`
                  : "border border-dashed border-border-strong text-text-subtle hover:border-primary/60 hover:text-text"
              }`}
            >
              <span className="text-caption text-text-muted">{label}</span>
              <span className="font-bold tabular-nums">{value ?? "적기"}</span>
            </button>
          ))}
        </div>
      ) : (
        (current.duration != null || bpm > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {current.duration != null && (
              <span className={`${chipClass} ${filledChip}`}>
                <span className="text-caption text-text-muted">길이</span>
                <span className="font-bold tabular-nums">{formatRuntime(current.duration)}</span>
              </span>
            )}
            {bpm > 0 && (
              <span className={`${chipClass} ${filledChip}`}>
                <span className="text-caption text-text-muted">BPM</span>
                <span className="font-bold tabular-nums">{bpm}</span>
              </span>
            )}
          </div>
        )
      )}

      {/* 메트로놈. 페이지를 나가면 합주 흐름이 끊긴다. 탭 템포가 바로 옆에서 BPM 을 채운다. */}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleMetronome}
          disabled={!metronome.isPlaying && !currentSong && !bpm}
          className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-pill px-4 text-sm font-semibold transition-colors disabled:text-text-subtle ${
            metronome.isPlaying
              ? "bg-primary text-on-primary hover:bg-primary-hover"
              : "border border-border text-text hover:bg-surface-hover disabled:hover:bg-transparent"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M9 3h6l4 18H5z" />
            <path d="M12 17V8" />
          </svg>
          {metronome.isPlaying
            ? `메트로놈 끄기${bpm ? ` · ${bpm}` : ""}`
            : bpm
              ? `메트로놈 · ${bpm}`
              : currentSong
                ? "BPM 적고 메트로놈 켜기"
                : "탭 템포로 BPM 맞추기"}
          {metronome.isPlaying && (
            <span className="ml-1 flex items-center gap-1" aria-hidden>
              {Array.from({ length: metronome.beatsPerBar }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-pill transition-colors ${metronome.beat === i ? "bg-white" : "bg-white/35"}`}
                />
              ))}
            </span>
          )}
        </button>
        <TapTempoButton
          key={current.id}
          onTempo={(value) => keepTappedBpm(current, value)}
          onCommit={(value, tapCount) => commitTappedBpm(current, value, tapCount)}
        />
      </div>

      {/* 입력칸은 바로 편집 상태로 연다. 접힌 것을 또 펼치게 하지 않는다. */}
      {showMeta && currentSong && (
        <div className="mt-3 overflow-hidden rounded-card border border-border text-left animate-fade-in">
          {/*
            입력칸은 열 때의 값을 들고 있다가 blur 에 전부 저장한다. 곡을 넘기거나 탭 템포가
            저장되면 새 값으로 다시 열어서, 옛 BPM 이 탭 결과를 덮어쓰지 않게 한다.
          */}
          <SongMeta
            key={`${currentSong.id}:${tapped?.songId === currentSong.id && tapped.saving ? tapped.bpm : ""}`}
            song={tappedBpm !== null ? { ...currentSong, tempo_bpm: tappedBpm } : currentSong}
            playlistId={playlistId}
            shareCode={shareCode}
            defaultOpen
            onClose={() => setShowMeta(false)}
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          ref={prevRef}
          variant="tonal"
          size="lg"
          aria-label="이전 곡"
          disabled={step === 0}
          onClick={() => goTo(step - 1, "prev")}
        >
          <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 5h2v14H6zM20 6.5v11a1 1 0 01-1.53.85l-8.5-5.5a1 1 0 010-1.7l8.5-5.5A1 1 0 0120 6.5z" />
          </svg>
        </Button>
        <Button
          ref={nextRef}
          variant={hasNext ? "primary" : "tonal"}
          size="lg"
          className="flex-1"
          disabled={!hasNext}
          onClick={() => goTo(step + 1, "next")}
        >
          {hasNext ? "다음으로" : "마지막 곡이에요"}
          {hasNext && (
            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M16 5h2v14h-2zM4 6.5v11a1 1 0 001.53.85l8.5-5.5a1 1 0 000-1.7l-8.5-5.5A1 1 0 004 6.5z" />
            </svg>
          )}
        </Button>
      </div>

      {currentSong && (
        <>
          <button
            type="button"
            aria-expanded={showComments}
            onClick={() => setShowComments((open) => !open)}
            className="mt-1 inline-flex min-h-11 items-center text-caption text-text-muted transition-colors hover:text-text"
          >
            코멘트 {songComments.length} · {showComments ? "접기" : "눌러서 보기"}
          </button>
          {showComments && (
            <div className="-mx-3 -mb-3 border-t border-border">
              <CommentSection
                songId={currentSong.id}
                comments={songComments}
                nickname={nickname}
                shareCode={shareCode}
                onCommentsChange={onCommentsChange}
                allComments={comments}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );

  return (
    <div>
      {/* 진행 상황. 합주 시간 관리는 밴드의 실제 문제다. */}
      <ScreenToolbar
        stat={`${step + 1} / ${steps.length}`}
        caption={current.remaining > 0 ? <span>남은 {formatRuntime(current.remaining)}</span> : undefined}
        actions={actions}
      >
        <div className="mt-2 flex gap-1" aria-hidden>
          {steps.map((s, j) => (
            <span
              key={s.id}
              className={`h-1.5 flex-1 rounded-pill transition-colors ${
                j < step ? "bg-primary/60" : j === step ? "bg-primary-fg" : "bg-surface-hover"
              }`}
            />
          ))}
        </div>
      </ScreenToolbar>

      <div className="pt-1">
        {steps.map((s, j) => (
          <Fragment key={s.id}>
            {j !== step + 1 &&
              s.before.map((interval) => <IntervalLine key={interval.id} interval={interval} past={j < step} />)}
            {j === step ? (
              <>
                {card}
                {upNext.map((interval) => (
                  <NextHint key={interval.id} interval={interval} />
                ))}
              </>
            ) : (
              <StepRow step={s} number={j + 1} done={j < step} onSelect={() => goTo(j, "jump")} />
            )}
          </Fragment>
        ))}
        {hasNext && trailing.map((interval) => <IntervalLine key={interval.id} interval={interval} past={false} />)}
      </div>
    </div>
  );
}

/**
 * 넘긴 뒤 지금 카드를 화면 안에 두고 포커스를 그 카드의 이동 버튼으로 옮긴다.
 * 카드는 장마다 목록의 다른 자리에 새로 그려져서, 누른 버튼과 함께 포커스가 사라진다.
 */
function useFollowCurrentStep(stepId: string | undefined) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const smooth = window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches;
    cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
    const next = nextRef.current;
    (next && !next.disabled ? next : prevRef.current)?.focus({ preventScroll: true });
  }, [stepId]);

  return {
    cardRef,
    nextRef,
    prevRef,
    follow: () => {
      pending.current = true;
    },
  };
}

function StepCover({ step, size }: { step: Step; size: "card" | "row" }) {
  const box = size === "card" ? "size-16" : "size-9";
  if (step.kind === "original") {
    return (
      <span className={`grid ${box} shrink-0 place-items-center rounded-control bg-primary-tint text-primary-fg`}>
        <svg className={size === "card" ? "size-7" : "size-4"} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`relative ${box} shrink-0 overflow-hidden rounded-control bg-surface-elevated`}>
      {step.song.thumbnail_url && (
        <Image src={step.song.thumbnail_url} alt="" fill sizes={size === "card" ? "64px" : "36px"} className="object-cover" />
      )}
    </span>
  );
}

function StepSubtitle({ step }: { step: Step }) {
  if (step.kind === "song") return <>{displayArtist(step.song.artist, step.song.title)}</>;
  return (
    <>
      <span className="text-primary-fg">자작곡</span>
      {step.description && ` · ${step.description}`}
    </>
  );
}

/** 지나간 곡은 커버와 표시만 흐리고 글자는 한 단계 낮은 색으로 둔다. 글자까지 흐리면 4.5:1 이 안 나온다. */
function StepRow({ step, number, done, onSelect }: { step: Step; number: number; done: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="block w-full rounded-control px-1 text-left transition-colors hover:bg-surface-hover"
    >
      <ListRow
        leading={
          <span className={`flex items-center gap-3 ${done ? "opacity-55" : ""}`}>
            {done ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-success-soft text-success">
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span className="sr-only">끝남</span>
              </span>
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-pill border-2 border-border-strong text-caption font-semibold tabular-nums text-text-muted">
                {number}
              </span>
            )}
            <StepCover step={step} size="row" />
          </span>
        }
        trailing={
          step.duration != null && (
            <span className={`text-caption tabular-nums ${done ? "text-text-subtle" : "text-text-muted"}`}>{formatRuntime(step.duration)}</span>
          )
        }
      >
        <span className={`block truncate text-sm font-medium ${done ? "text-text-muted" : "text-text"}`}>{step.title}</span>
        <span className={`block truncate text-caption ${done ? "text-text-subtle" : "text-text-muted"}`}>
          <StepSubtitle step={step} />
        </span>
      </ListRow>
    </button>
  );
}

function ClockIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IntervalLine({ interval, past }: { interval: RehearsalInterval; past: boolean }) {
  return (
    <p className={`ml-11 flex min-h-8 items-center gap-1.5 text-caption text-warning ${past ? "opacity-70" : ""}`}>
      <ClockIcon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate font-semibold">{interval.title}</span>
      {interval.duration > 0 && <span className="shrink-0 tabular-nums">· {formatRuntime(interval.duration)}</span>}
    </p>
  );
}

function NextHint({ interval }: { interval: RehearsalInterval }) {
  return (
    <p className="mb-1 flex min-h-11 items-center gap-2 rounded-control border border-warning/45 bg-warning-tint/60 px-3 text-sm text-warning">
      <ClockIcon className="size-4 shrink-0" />
      <span className="min-w-0 truncate font-semibold">다음: {interval.title}</span>
      {interval.duration > 0 && <span className="shrink-0 tabular-nums">· {formatRuntime(interval.duration)}</span>}
    </p>
  );
}

/**
 * 박자에 맞춰 4번 누르면 BPM 칸이 채워진다.
 * 곡마다 key 로 새로 마운트해서, 곡을 넘기면 남은 탭은 원래 곡에 저장되고 다음 곡은 빈 상태로 시작한다.
 */
function TapTempoButton({
  onTempo,
  onCommit,
}: {
  onTempo: (bpm: number) => void;
  onCommit: (bpm: number, tapCount: number) => void;
}) {
  const { tap, tapCount, tapsToFill } = useTapTempo(onCommit);
  return (
    <button
      type="button"
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-hover active:scale-95"
      onClick={() => {
        const value = tap();
        if (value !== null) onTempo(value);
      }}
    >
      탭 템포
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: tapsToFill }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-pill transition-colors ${i < tapCount ? "bg-primary" : "bg-border-strong"}`}
          />
        ))}
      </span>
    </button>
  );
}
