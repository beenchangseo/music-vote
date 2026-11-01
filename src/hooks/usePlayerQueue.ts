"use client";

import { useState, useCallback, useMemo } from "react";
import { setlistPlayOrder } from "@/domain/setlist";
import { displayTitle } from "@/domain/song-meta";
import type { SetlistItem, SongWithScore } from "@/domain/types";

type RepeatMode = "off" | "one";

/** 재생 순서의 출처. 후보곡은 점수 순, 셋리스트는 셋리 순서의 곡만. */
export type QueueSource = "candidates" | "setlist";

export type QueuedSong = SongWithScore & { shownTitle: string };

export interface PlayerState {
  currentSongId: string | null;
  /** 아무것도 틀지 않았으면 null. */
  source: QueueSource | null;
  /** 다음·이전 곡과 플레이어의 "다음 곡" 목록이 따르는 순서. */
  queue: QueuedSong[];
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  isPlaying: boolean;
  currentSong: QueuedSong | null;
}

export interface PlayerActions {
  /** source 를 주면 그 큐로 옮겨 재생한다. 빼면 지금 큐에 머문다. */
  playSong(id: string, source?: QueueSource): void;
  /** force: 사용자가 직접 누른 "다음" — 한 곡 반복이어도 넘어간다. 곡이 끝나서 부를 때는 쓰지 않는다. */
  playNext(force?: boolean): void;
  /** 목록 순서의 앞 곡 (첫 곡이면 마지막 곡). */
  playPrev(): void;
  toggleRepeat(): void;
  toggleShuffle(): void;
  setIsPlaying(v: boolean): void;
}

/**
 * @param songs 점수 순 후보곡
 * @param setlistItems 셋리스트. 아직 안 받았으면 null
 */
export function usePlayerQueue(songs: SongWithScore[], setlistItems: SetlistItem[] | null): {
  state: PlayerState;
  actions: PlayerActions;
} {
  const [nowPlaying, setNowPlaying] = useState<{ songId: string; source: QueueSource } | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleMode, setShuffleMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const candidatesQueue = useMemo(
    () => songs.map((song) => ({ ...song, shownTitle: displayTitle(song.title) })),
    [songs]
  );
  const setlistQueue = useMemo(
    () => (setlistItems ? setlistPlayOrder(setlistItems, songs) : []),
    [setlistItems, songs]
  );
  const queues: Record<QueueSource, QueuedSong[]> = { candidates: candidatesQueue, setlist: setlistQueue };
  const currentSongId = nowPlaying?.songId ?? null;
  const source = nowPlaying?.source ?? null;
  const queue = queues[source ?? "candidates"];

  const currentSong = useMemo(
    () => queue.find((s) => s.id === currentSongId) ?? candidatesQueue.find((s) => s.id === currentSongId) ?? null,
    [queue, candidatesQueue, currentSongId]
  );

  const playSong = useCallback((id: string, nextSource?: QueueSource) => {
    if (!id) {
      setNowPlaying(null);
      setIsPlaying(false);
      return;
    }
    setNowPlaying((prev) => ({ songId: id, source: nextSource ?? prev?.source ?? "candidates" }));
    setIsPlaying(true);
  }, []);

  const playNext = useCallback((force = false) => {
    if (queue.length === 0) return;

    if (!force && repeatMode === "one" && currentSongId) {
      return; // Handled by the caller checking repeatMode
    }

    if (shuffleMode) {
      if (queue.length === 1) return;
      const others = queue.filter((s) => s.id !== currentSongId);
      const randomIndex = Math.floor(Math.random() * others.length);
      playSong(others[randomIndex].id);
      return;
    }

    const currentIndex = queue.findIndex((s) => s.id === currentSongId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % queue.length;
    playSong(queue[nextIndex].id);
  }, [queue, currentSongId, repeatMode, shuffleMode, playSong]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSongId);
    const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    playSong(queue[prevIndex].id);
  }, [queue, currentSongId, playSong]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === "off" ? "one" : "off"));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode((prev) => !prev);
  }, []);

  return {
    state: { currentSongId, source, queue, repeatMode, shuffleMode, isPlaying, currentSong },
    actions: { playSong, playNext, playPrev, toggleRepeat, toggleShuffle, setIsPlaying },
  };
}
