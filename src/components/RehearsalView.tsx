"use client";

import { useMemo, useState } from "react";
import Card from "./ui/Card";
import ScreenToolbar from "./ui/ScreenToolbar";
import Image from "next/image";
import SongMeta from "./SongMeta";
import CommentSection from "./CommentSection";
import { useMetronome } from "@/hooks/useMetronome";
import { displayArtist, formatKey } from "@/lib/song-meta";
import { effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime } from "@/lib/setlist-domain";
import type { SetlistItem, SongWithScore, Comment } from "@/lib/types";

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
  const [index, setIndex] = useState(0);
  const [showMeta, setShowMeta] = useState(false);

  const songMap = useMemo(() => {
    const map: Record<string, SongWithScore> = {};
    for (const s of songs) map[s.id] = s;
    return map;
  }, [songs]);

  const songItems = useMemo(
    () => [...setlistItems]
      .filter((i) => i.item_type === "song" && i.song_id && songMap[i.song_id])
      .sort((a, b) => a.position - b.position),
    [setlistItems, songMap]
  );

  const current = songItems[Math.min(index, songItems.length - 1)];
  const currentSong = current?.song_id ? songMap[current.song_id] : null;
  const next = songItems[index + 1];
  const nextSong = next?.song_id ? songMap[next.song_id] : null;

  // 남은 시간은 현재 곡부터 끝까지 더한다. 시간을 모르는 곡은 빠진다.
  const remaining = useMemo(() => {
    let total = 0;
    for (let i = index; i < songItems.length; i += 1) {
      const item = songItems[i];
      const song = item.song_id ? songMap[item.song_id] : null;
      if (song) total += effectiveSetlistDuration(item, song) ?? 0;
    }
    return total;
  }, [index, songItems, songMap]);

  const bpm = currentSong?.tempo_bpm ?? 0;
  const metronome = useMetronome(bpm || 120);

  if (loading) {
    return (
      <div className="mt-6 py-16 text-center text-text-subtle">
        <span className="inline-block h-8 w-8 animate-spin rounded-pill border-2 border-border-strong border-t-primary" />
        <p className="mt-3">합주 정보 불러오는 중...</p>
      </div>
    );
  }

  if (songItems.length === 0 || !currentSong || !current) {
    return (
      <div className="mt-6 py-16 text-center text-text-subtle">
        <p className="text-h4 font-medium">합주 모드</p>
        <p className="mt-1 text-sm">셋리스트에 곡을 넣으면 순서대로 진행할 수 있어요</p>
      </div>
    );
  }

  const duration = effectiveSetlistDuration(current, currentSong);
  const artist = displayArtist(currentSong.artist, currentSong.title);
  const songComments = comments.filter((c) => c.song_id === currentSong.id);
  const progress = Math.round(((index + 1) / songItems.length) * 100);

  return (
    <div>
      {/* 진행 상황. 합주 시간 관리는 밴드의 실제 문제다. */}
      <ScreenToolbar
        stat={`${index + 1} / ${songItems.length}`}
        caption={remaining > 0 ? <span>남은 {formatRuntime(remaining)}</span> : undefined}
        actions={actions}
      >
        <div className="mt-2 h-1 overflow-hidden rounded-pill bg-surface-hover">
          <div
            className="h-1 rounded-pill bg-accent-play transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </ScreenToolbar>

      {/* 현재 곡 */}
      <Card>
        <div className="flex items-start gap-3">
          {currentSong.thumbnail_url && (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-control">
              <Image src={currentSong.thumbnail_url} alt="" fill sizes="56px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-h4 font-bold leading-snug text-text">{effectiveSetlistTitle(current, currentSong)}</h2>
            {artist && <p className="mt-1 text-sm text-text-muted">{artist}</p>}
          </div>
        </div>

        {/* 합주실에서 악기 들고 볼 때 필요한 값들 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-control bg-surface-hover px-3 py-2">
            <p className="text-caption text-text-subtle">우리 키</p>
            <p className="mt-0.5 text-h4 font-bold leading-tight text-text">
              {formatKey(currentSong.key_root, currentSong.key_mode) || currentSong.key_memo || "—"}
            </p>
          </div>
          <div className="rounded-control bg-surface-hover px-3 py-2">
            <p className="text-caption text-text-subtle">BPM</p>
            <p className="mt-0.5 text-h4 font-bold leading-tight tabular-nums text-text">{bpm || "—"}</p>
          </div>
          <div className="rounded-control bg-surface-hover px-3 py-2">
            <p className="text-caption text-text-subtle">길이</p>
            <p className="mt-0.5 text-h4 font-bold leading-tight tabular-nums text-text">
              {duration != null ? formatRuntime(duration) : "—"}
            </p>
          </div>
        </div>

        {/* 메트로놈. 페이지를 나가면 합주 흐름이 끊긴다. */}
        <button
          type="button"
          onClick={metronome.toggle}
          disabled={!bpm}
          className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors disabled:opacity-40 ${
            metronome.isPlaying
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-text-muted hover:text-text"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M9 3h6l4 18H5z" />
            <path d="M12 17V8" />
          </svg>
          {!bpm ? "BPM을 적으면 메트로놈을 쓸 수 있어요" : metronome.isPlaying ? `메트로놈 끄기 · ${bpm}` : `메트로놈 · ${bpm}`}
          {metronome.isPlaying && (
            <span className="ml-1 flex items-center gap-1" aria-hidden>
              {Array.from({ length: metronome.beatsPerBar }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-pill transition-colors ${
                    metronome.beat === i ? "bg-primary" : "bg-border-strong"
                  }`}
                />
              ))}
            </span>
          )}
        </button>

        {/* 메타 입력은 접어둔다. 12줄의 `+ 메타 추가` 가 화면을 채우던 자리다. */}
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          aria-expanded={showMeta}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-caption text-text-subtle transition-colors hover:text-text-muted"
        >
          키·BPM 적어두기
          <svg className={`h-3.5 w-3.5 transition-transform ${showMeta ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {showMeta && (
          <div className="animate-fade-in">
            <SongMeta song={currentSong} playlistId={playlistId} shareCode={shareCode} />
          </div>
        )}
      </Card>

      {/* 곡 이동 */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="이전 곡"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border text-text-muted transition-colors hover:text-text disabled:opacity-30"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          {nextSong && next ? (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(songItems.length - 1, i + 1))}
              className="flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left"
            >
              <span className="shrink-0 text-caption text-text-subtle">다음</span>
              <span className="min-w-0 flex-1 truncate text-caption text-text-muted">
                {effectiveSetlistTitle(next, nextSong)}
              </span>
            </button>
          ) : (
            <p className="px-2 text-center text-caption text-text-subtle">마지막 곡이에요</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(songItems.length - 1, i + 1))}
          disabled={index >= songItems.length - 1}
          aria-label="다음 곡"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border text-text-muted transition-colors hover:text-text disabled:opacity-30"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 이 곡의 코멘트만 */}
      <Card padding="none" className="mt-4 overflow-hidden">
        <p className="border-b border-border px-3 py-2 text-caption font-semibold text-text-subtle">
          이 곡 코멘트
        </p>
        <CommentSection
          songId={currentSong.id}
          comments={songComments}
          nickname={nickname}
          shareCode={shareCode}
          onCommentsChange={onCommentsChange}
          allComments={comments}
        />
      </Card>
    </div>
  );
}
