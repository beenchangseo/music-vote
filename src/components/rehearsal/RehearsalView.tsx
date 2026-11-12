"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import ScreenToolbar from "../ui/ScreenToolbar";
import Image from "next/image";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { ListRowButton } from "../ui/ListRow";
import SongMeta from "./SongMeta";
import CommentSection from "./CommentSection";
import { useDialog } from "../ui/DialogProvider";
import { useMetronome, useTapTempo } from "@/hooks/useMetronome";
import { updateSongMeta } from "@/actions/song";
import { track } from "@/lib/analytics";
import { displayArtist, formatKey } from "@/domain/song-meta";
import { formatRuntime, rehearsalSteps, type RehearsalInterval, type RehearsalStep } from "@/domain/setlist";
import type { SetlistItem, SongWithScore, Comment } from "@/domain/types";
import { ClockIcon, DoneIcon, SkipIcon, SongIcon } from "@/components/ui/icons";

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
  // 다른 멤버가 순서를 바꾸거나 지금 장을 지워도 고른 장과 그 자리를 지금 목록 기준으로 맞춘다.
  // 그래야 지금 장이 지워졌을 때 지금 순서에서 바로 뒤 장으로 넘어가고, 넘어간 장을 계속 따라간다.
  if (selected && current && (selected.id !== current.id || selected.index !== step)) {
    setSelected({ id: current.id, index: step });
  }
  const currentSong = current?.kind === "song" ? current.song : null;
  const { cardRef, nextRef, prevRef, follow } = useFollowCurrentStep(current?.id);

  const pendingBpm = (songId: string) =>
    tapped && tapped.songId === songId && (!tapped.saving || isSavingBpm) ? tapped.bpm : null;
  const bpmOf = (s: Step) =>
    s.kind === "original" ? (originalBpm[s.id] ?? 0) : (pendingBpm(s.song.id) ?? s.song.tempo_bpm ?? 0);
  const tappedBpm = currentSong ? pendingBpm(currentSong.id) : null;
  const bpm = current ? bpmOf(current) : 0;
  const metronome = useMetronome(bpm || null);

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
        <p className="mt-3">합주 정보 불러오는 중…</p>
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
    setSelected({ id: steps[index].id, index });
    follow();
    track("rehearsal_action", { action });
  }

  function openMeta() {
    setShowMeta(true);
    track("rehearsal_action", { action: "meta_open" });
  }

  function toggleMetronome() {
    track("rehearsal_action", { action: metronome.isPlaying ? "metronome_off" : "metronome_on" });
    metronome.toggle();
  }

  // BPM 이 없으면 메트로놈은 막지 않고 BPM 입력칸으로 보낸다. 입력칸이 없는 자작곡만 막고, 탭 템포가 BPM 을 채운다.
  const metronomeAction = bpm
    ? { pressed: metronome.isPlaying, "aria-label": `메트로놈 ${bpm} BPM`, onClick: toggleMetronome }
    : currentSong
      ? { "aria-label": "메트로놈, BPM 적고 켜기", onClick: openMeta }
      : { "aria-label": "메트로놈, 탭 템포로 BPM 맞추기", disabled: true };

  const card = (
    <Card
      ref={cardRef}
      variant="selected"
      padding="sm"
      role="region"
      aria-label="지금 곡"
      aria-current="step"
      className="my-2 scroll-my-2"
      footer={
        currentSong && showComments ? (
          <CommentSection
            songId={currentSong.id}
            comments={songComments}
            nickname={nickname}
            shareCode={shareCode}
            onCommentsChange={onCommentsChange}
            allComments={comments}
          />
        ) : null
      }
    >
      <div className="flex items-center gap-3">
        <StepCover step={current} size="card" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-primary-fg">지금</p>
          <h2 className="line-clamp-2 break-keep-wrap text-h4 font-bold leading-snug text-text">{current.title}</h2>
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
        // 한 줄로 둔다. 남는 폭이 모자라면 키 칸만 줄고 긴 메모는 말줄임한다. BPM·길이는 글자 수가 정해져 있다.
        <div className="mt-3 grid grid-cols-[minmax(0,auto)_auto_auto] justify-start gap-2">
          {[
            { label: "키", value: formatKey(currentSong.key_root, currentSong.key_mode) || currentSong.key_memo },
            { label: "BPM", value: bpm ? String(bpm) : null },
            { label: "길이", value: current.duration != null ? formatRuntime(current.duration) : null },
          ].map(({ label, value }) => (
            <Button
              key={label}
              variant="tonal"
              size="sm"
              fullWidth
              onClick={openMeta}
              aria-label={value ? `${label} ${value} 고치기` : `${label} 적어두기`}
            >
              {/* 이름과 값은 자작곡 배지처럼 gap-1 로 붙여서, 320px 에서도 키 칸에 메모 글자 자리가 남는다. */}
              <span className="flex min-w-0 items-center gap-1">
                <span className="shrink-0 text-caption font-normal text-text-muted">{label}</span>
                <span className={`min-w-0 truncate font-bold tabular-nums ${value ? "" : "text-text-muted"}`}>{value ?? "적기"}</span>
              </span>
            </Button>
          ))}
        </div>
      ) : (
        // 곡 행이 없는 장은 고친 값을 저장할 곳이 없다. 그래서 눌러지는 버튼이 아니라 배지로 보여 준다.
        (current.duration != null || bpm > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {current.duration != null && (
              <Badge className="gap-1">
                길이<span>{formatRuntime(current.duration)}</span>
              </Badge>
            )}
            {bpm > 0 && (
              <Badge className="gap-1">
                BPM<span>{bpm}</span>
              </Badge>
            )}
          </div>
        )
      )}

      {/*
        메트로놈. 페이지를 나가면 합주 흐름이 끊긴다. 탭 템포가 바로 옆에서 BPM 을 채운다.
        BPM 이 있든 없든, 켜든 끄든 글자와 박자 점이 같아서 폭이 그대로다. 그래서 320px 에서도 한 줄이고
        장을 넘겨도 탭 템포가 제자리에 있다. BPM 은 바로 위 BPM 칸이 보여 주고, 스크린 리더는 이름으로 읽는다.
      */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="tonal" size="sm" {...metronomeAction}>
          메트로놈
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: metronome.beatsPerBar }, (_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-pill transition-colors ${!metronome.isPlaying ? "bg-border-strong" : metronome.beat === i ? "bg-on-primary" : "bg-on-primary/35"}`}
              />
            ))}
          </span>
        </Button>
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
          <SkipIcon direction="previous" className="size-5" />
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
            <SkipIcon direction="next" className="size-5" />
          )}
        </Button>
      </div>

      {currentSong && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          aria-expanded={showComments}
          onClick={() => setShowComments((open) => !open)}
        >
          코멘트 {songComments.length} · {showComments ? "접기" : "눌러서 보기"}
        </Button>
      )}
    </Card>
  );

  return (
    <div>
      {/* 진행 상황. 합주 시간 관리는 밴드의 실제 문제다. */}
      <ScreenToolbar
        stat={`${step + 1} / ${steps.length}`}
        caption={current.remaining > 0 ? <span>남은 {formatRuntime(current.remaining)}</span> : undefined}
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
            {/* 지금 카드 위의 인터벌은 맨 앞 인터벌까지 지난 것이다. 남은 시간도 이 장이 시작하는 시각부터 센다. */}
            {j !== step + 1 &&
              s.before.map((interval) => <IntervalLine key={interval.id} interval={interval} past={j <= step} />)}
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
      <span className={`grid ${box} shrink-0 place-items-center rounded-control bg-surface-elevated text-primary-fg`}>
        <SongIcon className={size === "card" ? "size-7" : "size-4"} />
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

/**
 * 지나간 곡은 커버와 표시만 흐리고 글자는 한 단계 낮은 색으로 둔다. 글자까지 흐리면 4.5:1 이 안 나온다.
 * 이름은 제목과 끝남만이다. 아티스트·길이까지 이름에 넣으면 제목을 품은 아티스트가 한 번 더 읽혀서 설명으로 뺐다.
 */
function StepRow({ step, number, done, onSelect }: { step: Step; number: number; done: boolean; onSelect: () => void }) {
  const id = useId();
  return (
    <ListRowButton
      onClick={onSelect}
      aria-label={done ? `${step.title}, 끝남` : step.title}
      aria-describedby={step.duration != null ? `${id}-sub ${id}-len` : `${id}-sub`}
      leading={
        <StepLead
          className={done ? "opacity-55" : ""}
          marker={
            done ? (
              <span className="grid size-full place-items-center rounded-pill bg-success-soft text-success">
                <DoneIcon className="size-4" />
              </span>
            ) : (
              <span className="grid size-full place-items-center rounded-pill border-2 border-border-strong text-caption font-semibold tabular-nums text-text-muted">
                {number}
              </span>
            )
          }
        >
          <StepCover step={step} size="row" />
        </StepLead>
      }
      trailing={
        step.duration != null && (
          <span id={`${id}-len`} className={`text-caption tabular-nums ${done ? "text-text-subtle" : "text-text-muted"}`}>
            {formatRuntime(step.duration)}
          </span>
        )
      }
    >
      <span className={`block truncate text-sm font-medium ${done ? "text-text-muted" : "text-text"}`}>{step.title}</span>
      <span id={`${id}-sub`} className={`block truncate text-caption ${done ? "text-text-subtle" : "text-text-muted"}`}>
        <StepSubtitle step={step} />
      </span>
    </ListRowButton>
  );
}

/**
 * [표시 칸][내용]. 단계 행은 표시 칸에 번호·끝남 원을, 인터벌 줄은 빈 칸을 둔다.
 * 같은 칸과 같은 간격을 지나서 인터벌 줄의 시계가 행의 커버와 같은 세로줄에 선다.
 */
function StepLead({ marker, className = "", children }: { marker?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <span className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span className="grid size-7 shrink-0 place-items-center">{marker}</span>
      {children}
    </span>
  );
}

function IntervalLine({ interval, past }: { interval: RehearsalInterval; past: boolean }) {
  return (
    <p className={`flex min-h-8 items-center text-caption ${past ? "text-text-subtle" : "text-text-muted"}`}>
      <StepLead>
        <span className="flex min-w-0 items-center gap-1.5">
          <ClockIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate font-medium">{interval.title}</span>
          {interval.duration > 0 && <span className="shrink-0 tabular-nums">· {formatRuntime(interval.duration)}</span>}
        </span>
      </StepLead>
    </p>
  );
}

function NextHint({ interval }: { interval: RehearsalInterval }) {
  return (
    <p className="mb-1 flex min-h-11 items-center gap-2 rounded-control bg-surface-hover px-3 text-sm text-text-muted">
      <ClockIcon className="size-4 shrink-0" />
      <span className="min-w-0 truncate font-medium">다음: {interval.title}</span>
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
    <Button
      variant="tonal"
      size="sm"
      className="shrink-0"
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
            className={`size-1.5 rounded-pill transition-colors ${i < tapCount ? "bg-primary" : "bg-border-strong"}`}
          />
        ))}
      </span>
    </Button>
  );
}
