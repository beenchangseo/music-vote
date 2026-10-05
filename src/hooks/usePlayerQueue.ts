"use client";

import { useState, useCallback, useMemo } from "react";
import type { SongWithScore } from "@/lib/types";

type RepeatMode = "off" | "one";

export interface PlayerState {
  currentSongId: string | null;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  isPlaying: boolean;
  currentSong: SongWithScore | null;
}

export interface PlayerActions {
  playSong(id: string): void;
  /** force: 사용자가 직접 누른 "다음" — 한 곡 반복이어도 넘어간다. 곡이 끝나서 부를 때는 쓰지 않는다. */
  playNext(force?: boolean): void;
  /** 목록 순서의 앞 곡 (첫 곡이면 마지막 곡). */
  playPrev(): void;
  toggleRepeat(): void;
  toggleShuffle(): void;
  setIsPlaying(v: boolean): void;
}

export function usePlayerQueue(songs: SongWithScore[]): {
  state: PlayerState;
  actions: PlayerActions;
} {
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleMode, setShuffleMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentSongId) ?? null,
    [songs, currentSongId]
  );

  const playSong = useCallback((id: string) => {
    if (!id) {
      setCurrentSongId(null);
      setIsPlaying(false);
      return;
    }
    setCurrentSongId(id);
    setIsPlaying(true);
  }, []);

  const playNext = useCallback((force = false) => {
    if (songs.length === 0) return;

    if (!force && repeatMode === "one" && currentSongId) {
      return; // Handled by the caller checking repeatMode
    }

    if (shuffleMode) {
      if (songs.length === 1) return;
      const candidates = songs.filter((s) => s.id !== currentSongId);
      const randomIndex = Math.floor(Math.random() * candidates.length);
      setCurrentSongId(candidates[randomIndex].id);
      setIsPlaying(true);
      return;
    }

    const currentIndex = songs.findIndex((s) => s.id === currentSongId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % songs.length;
    setCurrentSongId(songs[nextIndex].id);
    setIsPlaying(true);
  }, [songs, currentSongId, repeatMode, shuffleMode]);

  const playPrev = useCallback(() => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex((s) => s.id === currentSongId);
    const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
    setCurrentSongId(songs[prevIndex].id);
    setIsPlaying(true);
  }, [songs, currentSongId]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === "off" ? "one" : "off"));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode((prev) => !prev);
  }, []);

  return {
    state: { currentSongId, repeatMode, shuffleMode, isPlaying, currentSong },
    actions: { playSong, playNext, playPrev, toggleRepeat, toggleShuffle, setIsPlaying },
  };
}
