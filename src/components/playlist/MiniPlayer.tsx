"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import type { PlayerState, PlayerActions } from "@/hooks/usePlayerQueue";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
import { trapTabKey } from "../ui/focus-trap";
import { publishMiniPlayerHeight } from "../ui/chrome-inset";
import { ChevronIcon, PlayPauseIcon, RepeatIcon, ShuffleIcon, SkipIcon } from "../ui/icons";
import { ListRowButton } from "../ui/ListRow";
import RoundButton from "../ui/RoundButton";
import { displayArtist } from "@/domain/song-meta";

interface MiniPlayerProps {
  state: PlayerState;
  actions: PlayerActions;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
  /** 펼친 화면에서 지금 곡 아래에 놓을 것 (투표 알약 등). */
  songActions?: ReactNode;
  /** 영상. 곡이 바뀌어도 여기 그대로 머문다. 옮기면 브라우저가 다시 로드한다. */
  children?: ReactNode;
}

/** "이전"을 눌렀을 때 이 초보다 많이 들었으면 앞 곡이 아니라 이 곡 처음으로 (음악 앱 관례). */
const RESTART_THRESHOLD_SECONDS = 3;
const UP_NEXT_COUNT = 4;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * YouTube Music 식 재생 컨트롤러. 평소에는 하단 탭 위의 막대(진행선 · 곡 · 재생 · 다음),
 * 막대를 누르면 같은 요소가 전체 화면으로 커진다(영상 · 투표 · 진행 막대 · 셔플/이전/재생/다음/반복 · 다음 곡).
 *
 * 영상 iframe 은 처음 자리에서 움직이지 않는다. 모달로 옮기면 브라우저가 iframe 을 다시 로드해
 * 모바일에서 다음 곡 자동 재생 허용이 풀린다. 그래서 펼침은 포털이 아니라 같은 컨테이너의 CSS 로 한다.
 */
export default function MiniPlayer({ state, actions, playerRef, songActions, children }: MiniPlayerProps) {
  const { currentSong, isPlaying, repeatMode, shuffleMode, queue, source } = state;
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // The YouTube iframe API has no time events: poll while something is loaded.
  useEffect(() => {
    if (!currentSong) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setProgress({ current: player.getCurrentTime(), duration: player.getDuration() });
    }, 500);
    return () => window.clearInterval(id);
  }, [currentSong, playerRef]);

  // Expanded = a modal screen: no page scroll behind it, Esc closes, Tab stays inside.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    collapseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
      else if (e.key === "Tab" && containerRef.current) trapTabKey(e, containerRef.current);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      returnFocus.current = true;
    };
  }, [expanded]);

  // The bar is not rendered while expanded, so focus goes back only after the collapsed bar has mounted again.
  useEffect(() => {
    if (expanded || !returnFocus.current) return;
    returnFocus.current = false;
    barRef.current?.focus();
  }, [expanded]);

  if (!currentSong) return null;

  const artist = displayArtist(currentSong.artist, currentSong.title);
  const ratio = progress.duration > 0 ? Math.min(1, progress.current / progress.duration) : 0;
  const currentIndex = queue.findIndex((song) => song.id === currentSong.id);
  const upNext = shuffleMode
    ? []
    : Array.from({ length: Math.min(UP_NEXT_COUNT, Math.max(0, queue.length - 1)) }, (_, i) => queue[(currentIndex + 1 + i) % queue.length]);

  function handlePlayPause() {
    if (isPlaying) playerRef.current?.pause();
    else playerRef.current?.play();
  }

  function handlePrev() {
    if (progress.current > RESTART_THRESHOLD_SECONDS) {
      playerRef.current?.seekTo(0);
      return;
    }
    actions.playPrev();
  }

  return (
    <div
      ref={containerRef}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? "재생 중인 곡" : undefined}
      className={
        expanded
          ? "fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-bg print:hidden"
          : "fixed inset-x-0 bottom-dock z-50 bg-surface/95 backdrop-blur-md print:hidden"
      }
    >
      {/* Expanded top bar (slot 0). Rendered with && so the video wrapper below never changes position. */}
      {expanded && (
        <div className="mx-auto flex w-full max-w-lg shrink-0 items-center justify-between px-2 pt-3">
          <RoundButton ref={collapseRef} tone="plain" size="md" onClick={() => setExpanded(false)} aria-label="플레이어 접기">
            <ChevronIcon direction="down" />
          </RoundButton>
          <p className="text-caption font-semibold text-text-muted">{source === "setlist" ? "셋리스트" : "후보곡"} 재생 중</p>
          <span className="size-control-md" aria-hidden />
        </div>
      )}

      {/*
        영상 자리 (slot 1). 접혀 있어도 언마운트하지 않고 높이만 0 으로 둔다.
        영상을 떼었다 붙이면 모바일에서 다음 곡 자동 재생 허용이 풀린다.
      */}
      <div
        className={`mx-auto w-full max-w-lg overflow-hidden ${expanded ? "shrink-0 px-4 pt-4" : "max-h-0"}`}
        aria-hidden={!expanded}
      >
        {children}
      </div>

      {expanded ? (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8">
          <div className="mt-6 min-w-0">
            <h2 className="line-clamp-2 break-keep text-h3 font-bold leading-snug text-text">{currentSong.shownTitle}</h2>
            {artist && <p className="mt-1 truncate text-body text-text-muted">{artist}</p>}
          </div>

          {songActions && <div className="mt-4 flex items-center gap-2">{songActions}</div>}

          {/* Progress (YouTube Music: thin line with times under it). */}
          <div className="mt-6">
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(progress.duration))}
              step={1}
              value={Math.floor(progress.current)}
              onChange={(e) => {
                const seconds = Number(e.target.value);
                playerRef.current?.seekTo(seconds);
                setProgress((p) => ({ ...p, current: seconds }));
              }}
              aria-label="재생 위치"
              aria-valuetext={`${formatTime(progress.current)} / ${formatTime(progress.duration)}`}
              className="block h-11 w-full cursor-pointer accent-text"
            />
            <div className="flex justify-between text-caption tabular-nums text-text-muted">
              <span>{formatTime(progress.current)}</span>
              <span>{formatTime(progress.duration)}</span>
            </div>
          </div>

          {/* Transport controls. */}
          <div className="mt-4 flex items-center justify-between">
            <RoundButton size="md" pressed={shuffleMode} onClick={actions.toggleShuffle} aria-label={shuffleMode ? "셔플 끄기" : "셔플 켜기"}>
              <ShuffleIcon />
            </RoundButton>
            <RoundButton tone="plain" size="lg" onClick={handlePrev} aria-label="이전 곡">
              <SkipIcon direction="previous" />
            </RoundButton>
            <RoundButton tone="inverse" size="hero" onClick={handlePlayPause} aria-label={isPlaying ? "일시정지" : "재생"}>
              <PlayPauseIcon playing={isPlaying} />
            </RoundButton>
            <RoundButton tone="plain" size="lg" onClick={() => actions.playNext(true)} aria-label="다음 곡">
              <SkipIcon direction="next" />
            </RoundButton>
            <RoundButton
              size="md"
              pressed={repeatMode === "one"}
              onClick={actions.toggleRepeat}
              aria-label={repeatMode === "one" ? "반복 끄기" : "한곡 반복"}
            >
              <RepeatIcon one={repeatMode === "one"} />
            </RoundButton>
          </div>

          {/* Up next (YouTube Music "다음 트랙"). */}
          <section aria-labelledby="player-up-next" className="mt-8">
            <h3 id="player-up-next" className="text-sm font-semibold text-text">
              다음 곡
            </h3>
            {shuffleMode ? (
              <p className="mt-2 text-sm text-text-muted">셔플 중이라 다음 곡을 미리 알 수 없어요</p>
            ) : upNext.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">이 곡 하나뿐이에요</p>
            ) : (
              <ul className="mt-2">
                {upNext.map((song) => (
                  <li key={song.id}>
                    <ListRowButton onClick={() => actions.playSong(song.id)} leading={<Cover url={song.thumbnail_url} />}>
                      <span className="block truncate text-sm font-medium text-text">{song.shownTitle}</span>
                      {displayArtist(song.artist, song.title) && (
                        <span className="block truncate text-caption text-text-muted">{displayArtist(song.artist, song.title)}</span>
                      )}
                    </ListRowButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div ref={publishMiniPlayerHeight}>
          {/* Thin progress line along the top edge (YouTube Music mini player). */}
          <div className="h-0.5 w-full bg-surface-hover" aria-hidden>
            <div className="h-0.5 bg-text transition-[width] duration-500 ease-linear" style={{ width: `${ratio * 100}%` }} />
          </div>
          {/* gap-2: the bar's hover fill reaches 8px past its column, so it stops at the play button instead of under it. */}
          <div className="mx-auto flex max-w-lg items-center gap-2 px-4">
            <ListRowButton
              ref={barRef}
              onClick={() => setExpanded(true)}
              className="flex-1"
              aria-label={`${currentSong.shownTitle} 플레이어 열기`}
              leading={<Cover url={currentSong.thumbnail_url} />}
            >
              <span className="block truncate text-sm font-semibold text-text">{currentSong.shownTitle}</span>
              {artist && <span className="block truncate text-caption text-text-muted">{artist}</span>}
            </ListRowButton>
            <div className="flex shrink-0 items-center gap-1">
              <RoundButton tone="plain" size="md" onClick={handlePlayPause} aria-label={isPlaying ? "일시정지" : "재생"}>
                <PlayPauseIcon playing={isPlaying} />
              </RoundButton>
              <RoundButton tone="plain" size="md" onClick={() => actions.playNext(true)} aria-label="다음 곡">
                <SkipIcon direction="next" />
              </RoundButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 40px 커버. 56px 행 안에 위아래 8px 을 남긴다. */
function Cover({ url }: { url: string | null }) {
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-control bg-surface-elevated">
      {url && <Image src={url} alt="" fill sizes="40px" className="object-cover" />}
    </span>
  );
}
