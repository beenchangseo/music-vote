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
  playNext(): void;
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

  const playNext = useCallback(() => {
    if (songs.length === 0) return;

    if (repeatMode === "one" && currentSongId) {
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

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === "off" ? "one" : "off"));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode((prev) => !prev);
  }, []);

  return {
    state: { currentSongId, repeatMode, shuffleMode, isPlaying, currentSong },
    actions: { playSong, playNext, toggleRepeat, toggleShuffle, setIsPlaying },
  };
}
