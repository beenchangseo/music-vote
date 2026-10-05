"use client";

import { useMemo, useState, useTransition } from "react";
import ScreenToolbar from "./ui/ScreenToolbar";
import Image from "next/image";
import SongMeta from "./SongMeta";
import CommentSection from "./CommentSection";
import { useDialog } from "./DialogProvider";
import { useMetronome, useTapTempo } from "@/hooks/useMetronome";
import { updateSongMeta } from "@/actions/song";
import { track } from "@/lib/analytics";
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
  // 탭 템포 값. 탭하는 동안과 저장이 끝날 때까지만 서버 값 대신 보인다.
  const [tapped, setTapped] = useState<{ songId: string; bpm: number; saving: boolean } | null>(null);
  const [isSavingBpm, startSavingBpm] = useTransition();
  const { showAlert } = useDialog();

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

  const tappedBpm =
    tapped && tapped.songId === currentSong?.id && (!tapped.saving || isSavingBpm) ? tapped.bpm : null;
  const bpm = tappedBpm ?? currentSong?.tempo_bpm ?? 0;
  const metronome = useMetronome(bpm || 120);

  // 묶음이 끝나면 한 번 저장한다. 실패하면 전환이 끝나면서 서버 값으로 돌아간다.
  function saveTappedBpm(songId: string, value: number, tapCount: number) {
    track("tap_tempo_used", { taps: tapCount });
    setTapped({ songId, bpm: value, saving: true });
    if (songMap[songId]?.tempo_bpm === value) return;
    startSavingBpm(async () => {
      try {
        await updateSongMeta(songId, playlistId, shareCode, { tempoBpm: value });
      } catch {
        showAlert("BPM 을 저장하지 못했어요. 다시 탭해 주세요.");
      }
    });
  }

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

  function go(delta: -1 | 1) {
    setIndex((i) => Math.min(songItems.length - 1, Math.max(0, i + delta)));
    track("rehearsal_action", { action: delta === 1 ? "next" : "prev" });
  }

  function openMeta() {
    setShowMeta(true);
    track("rehearsal_action", { action: "meta_open" });
  }

  function toggleMetronome() {
    if (!bpm) {
      openMeta();
      return;
    }
    track("rehearsal_action", { action: metronome.isPlaying ? "metronome_off" : "metronome_on" });
    metronome.toggle();
  }

  return (
    <div>
      {/* 진행 상황. 합주 시간 관리는 밴드의 실제 문제다. */}
      <ScreenToolbar
        stat={`${index + 1} / ${songItems.length}`}
        caption={remaining > 0 ? <span>남은 {formatRuntime(remaining)}</span> : undefined}
        actions={actions}
      >
        <div className="mt-2 h-1 overflow-hidden rounded-pill bg-surface-hover">
          <div className="h-1 rounded-pill bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </ScreenToolbar>

      {/* 지금 곡 (YouTube Music 재생 화면): 큰 커버, 제목, 키·BPM·길이 칩. */}
      <section aria-label="지금 곡" className="pt-2 text-center">
        <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-card bg-surface-elevated shadow-xl shadow-black/40">
          {currentSong.thumbnail_url && (
            <Image src={currentSong.thumbnail_url} alt="" fill sizes="176px" className="object-cover" />
          )}
        </div>
        <h2 className="mt-5 line-clamp-2 break-keep text-h3 font-bold leading-snug text-text">
          {effectiveSetlistTitle(current, currentSong)}
        </h2>
        {artist && <p className="mt-1 text-sm text-text-muted">{artist}</p>}

        {/*
          합주실에서 악기 들고 볼 때 필요한 값들.
          비어 있으면 그 자리를 눌러 바로 채운다 — 종전에는 접힌 `키·BPM 적어두기` 를
          펼치고, 그 안의 `메타 추가` 를 또 눌러야 입력칸이 나왔다. 두 번 접혀 있었다.
        */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[
            { label: "우리 키", value: formatKey(currentSong.key_root, currentSong.key_mode) || currentSong.key_memo },
            { label: "BPM", value: bpm ? String(bpm) : null },
            { label: "길이", value: duration != null ? formatRuntime(duration) : null },
          ].map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={openMeta}
              aria-label={value ? `${label} ${value} 고치기` : `${label} 적어두기`}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill px-4 text-sm transition-colors ${
                value
                  ? "bg-surface-hover text-text hover:bg-surface-elevated"
                  : "border border-dashed border-border-strong text-text-subtle hover:border-primary/60 hover:text-text"
              }`}
            >
              <span className="text-caption text-text-muted">{label}</span>
              <span className="font-bold tabular-nums">{value ?? "적기"}</span>
            </button>
          ))}
        </div>

        {/* 메트로놈. 페이지를 나가면 합주 흐름이 끊긴다. 탭 템포가 바로 옆에서 BPM 을 채운다. */}
        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            onClick={toggleMetronome}
            className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-pill px-5 text-sm font-semibold transition-colors ${
              metronome.isPlaying
                ? "bg-primary text-white hover:bg-primary-hover"
                : "border border-border text-text hover:bg-surface-hover"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
              <path d="M9 3h6l4 18H5z" />
              <path d="M12 17V8" />
            </svg>
            {!bpm ? "BPM 적고 메트로놈 켜기" : metronome.isPlaying ? `메트로놈 끄기 · ${bpm}` : `메트로놈 · ${bpm}`}
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
            key={currentSong.id}
            onTempo={(value) => setTapped({ songId: currentSong.id, bpm: value, saving: false })}
            onCommit={(value, tapCount) => saveTappedBpm(currentSong.id, value, tapCount)}
          />
        </div>

        {/* 입력칸은 바로 편집 상태로 연다. 접힌 것을 또 펼치게 하지 않는다. */}
        {showMeta && (
          <div className="mt-4 overflow-hidden rounded-card border border-border text-left animate-fade-in">
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
      </section>

      {/* 곡 이동 (재생 화면 컨트롤처럼 크게). */}
      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="이전 곡"
          className="inline-flex h-14 w-14 items-center justify-center rounded-pill bg-surface-hover text-text transition-all hover:bg-surface-elevated active:scale-95 disabled:opacity-30"
        >
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 5h2v14H6zM20 6.5v11a1 1 0 01-1.53.85l-8.5-5.5a1 1 0 010-1.7l8.5-5.5A1 1 0 0120 6.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index >= songItems.length - 1}
          aria-label="다음 곡"
          className="inline-flex h-16 w-16 items-center justify-center rounded-pill bg-primary text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover active:scale-95 disabled:bg-surface-hover disabled:text-text-subtle disabled:shadow-none"
        >
          <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M16 5h2v14h-2zM4 6.5v11a1 1 0 001.53.85l8.5-5.5a1 1 0 000-1.7l-8.5-5.5A1 1 0 004 6.5z" />
          </svg>
        </button>
      </div>

      {/* 다음 곡 (YouTube Music "다음 트랙"). */}
      <div className="mt-6">
        <p className="text-caption font-semibold text-text-subtle">다음</p>
        {nextSong && next ? (
          <button
            type="button"
            onClick={() => go(1)}
            className="-mx-2 mt-1 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 text-left transition-colors hover:bg-surface-hover"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-control bg-surface-elevated">
              {nextSong.thumbnail_url && <Image src={nextSong.thumbnail_url} alt="" fill sizes="44px" className="object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">{effectiveSetlistTitle(next, nextSong)}</span>
              {displayArtist(nextSong.artist, nextSong.title) && (
                <span className="block truncate text-caption text-text-muted">{displayArtist(nextSong.artist, nextSong.title)}</span>
              )}
            </span>
          </button>
        ) : (
          <p className="mt-1 text-sm text-text-muted">마지막 곡이에요</p>
        )}
      </div>

      {/* 이 곡의 코멘트만 */}
      <section className="mt-6 overflow-hidden rounded-card bg-surface">
        <p className="px-4 pb-1 pt-3 text-sm font-semibold text-text">이 곡 코멘트</p>
        <CommentSection
          songId={currentSong.id}
          comments={songComments}
          nickname={nickname}
          shareCode={shareCode}
          onCommentsChange={onCommentsChange}
          allComments={comments}
        />
      </section>
    </div>
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
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border border-border px-5 text-sm font-semibold text-text transition-colors hover:bg-surface-hover active:scale-95"
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
