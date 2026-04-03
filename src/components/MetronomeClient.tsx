"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import type { Song } from "@/lib/types";

interface MetronomeClientProps {
  shareCode: string;
  playlistTitle: string;
  songs: Pick<Song, "id" | "title" | "artist" | "tempo_bpm">[];
  initialBpm?: number;
  initialSongId?: string;
}

export default function MetronomeClient({ shareCode, playlistTitle, songs, initialBpm, initialSongId }: MetronomeClientProps) {
  const initialSong = initialSongId ? songs.find((s) => s.id === initialSongId) : songs[0];
  const [bpm, setBpm] = useState(initialBpm || initialSong?.tempo_bpm || 120);
  const [selectedSongId, setSelectedSongId] = useState(initialSongId || initialSong?.id || "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0); // 0-3

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);

  // Lookahead scheduler constants
  const SCHEDULE_AHEAD = 0.1; // 100ms lookahead
  const TIMER_INTERVAL = 25; // 25ms pump interval

  const playClick = useCallback((time: number, accent: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = accent ? 1000 : 800;
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const isAccent = beatRef.current === 0;
      playClick(nextNoteTimeRef.current, isAccent);

      const currentBeat = beatRef.current;
      // Schedule UI update at the right time
      const delay = (nextNoteTimeRef.current - ctx.currentTime) * 1000;
      setTimeout(() => setBeat(currentBeat), Math.max(0, delay));

      // Advance
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTimeRef.current += secondsPerBeat;
      beatRef.current = (beatRef.current + 1) % 4;
    }
  }, [bpm, playClick]);

  const start = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    beatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime;
    setBeat(0);
    setIsPlaying(true);

    timerRef.current = setInterval(scheduler, TIMER_INTERVAL);
  }, [scheduler]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setBeat(0);
  }, []);

  // Restart scheduler when BPM changes during playback
  useEffect(() => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(scheduler, TIMER_INTERVAL);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scheduler, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  function handleSongChange(songId: string) {
    setSelectedSongId(songId);
    const song = songs.find((s) => s.id === songId);
    if (song?.tempo_bpm) {
      setBpm(song.tempo_bpm);
    }
  }

  const selectedSong = songs.find((s) => s.id === selectedSongId);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-4 py-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/playlist/${shareCode}`}
            className="p-2 rounded-xl bg-surface border border-border hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-100">메트로놈</h1>
            <p className="text-xs text-gray-500">{playlistTitle}</p>
          </div>
        </div>
      </div>

      {/* Metronome body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-8">
        {/* Beat indicators */}
        <p className="text-xs text-gray-500 mb-2">4/4 박자</p>
        <div className="flex gap-5 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full transition-all duration-75 ${
                isPlaying && beat === i
                  ? i === 0
                    ? "bg-primary scale-125 shadow-lg shadow-primary/50"
                    : "bg-white scale-110"
                  : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* BPM display */}
        <div className="text-center mb-6">
          <p className="text-7xl font-bold text-gray-100 tabular-nums">{bpm}</p>
          <p className="text-sm text-gray-500 mt-1">BPM</p>
        </div>

        {/* BPM controls */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setBpm((b) => Math.max(40, b - 5))}
            className="w-12 h-12 rounded-full bg-gray-800 border border-border text-gray-300 text-xl font-bold hover:bg-gray-700 transition-colors"
          >
            -5
          </button>
          <button
            onClick={() => setBpm((b) => Math.max(40, b - 1))}
            className="w-10 h-10 rounded-full bg-gray-800 border border-border text-gray-300 text-lg hover:bg-gray-700 transition-colors"
          >
            -
          </button>

          {/* Play/Stop */}
          <button
            onClick={isPlaying ? stop : start}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all active:scale-95 ${
              isPlaying
                ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30"
                : "bg-primary hover:bg-primary-hover shadow-lg shadow-primary/30"
            }`}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setBpm((b) => Math.min(300, b + 1))}
            className="w-10 h-10 rounded-full bg-gray-800 border border-border text-gray-300 text-lg hover:bg-gray-700 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setBpm((b) => Math.min(300, b + 5))}
            className="w-12 h-12 rounded-full bg-gray-800 border border-border text-gray-300 text-xl font-bold hover:bg-gray-700 transition-colors"
          >
            +5
          </button>
        </div>

        {/* Song selector */}
        {songs.length > 0 && (
          <div className="w-full max-w-xs">
            <select
              value={selectedSongId}
              onChange={(e) => handleSongChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-border text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">곡 선택...</option>
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.tempo_bpm} BPM)
                </option>
              ))}
            </select>
            {selectedSong && (
              <p className="text-center text-xs text-gray-500 mt-2">
                현재: <span className="text-primary">{selectedSong.title}</span> · {selectedSong.tempo_bpm} BPM
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
