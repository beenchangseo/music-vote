"use client";

import { useState } from "react";
import { useMetronome } from "@/hooks/useMetronome";
import { displayTitle } from "@/domain/song-meta";
import { controlSkin } from "../ui/Input";
import PlayPauseIcon from "../ui/PlayPauseIcon";
import RoundButton, { RoundLink, RoundRow } from "../ui/RoundButton";
import type { Song } from "@/domain/types";

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
  const { isPlaying, beat, start, stop } = useMetronome(bpm);

  function handleSongChange(songId: string) {
    setSelectedSongId(songId);
    const song = songs.find((s) => s.id === songId);
    if (song?.tempo_bpm) {
      setBpm(song.tempo_bpm);
    }
  }

  const selectedSong = songs.find((s) => s.id === selectedSongId);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-4 py-4">
        <div className="flex items-center gap-3">
          <RoundLink href={`/playlist/${shareCode}`} tone="ghost" size="md" edge="start" aria-label="플레이리스트로 돌아가기">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </RoundLink>
          <div>
            <h1 className="text-h4 font-bold text-text">메트로놈</h1>
            <p className="text-caption text-text-subtle">{playlistTitle}</p>
          </div>
        </div>
      </div>

      {/* Metronome body. pb-8 lifts the centred block 16px above the middle of the space under the header. */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* Beat indicators */}
        <p className="text-caption text-text-subtle mb-2">4/4 박자</p>
        <div className="flex gap-5 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`size-6 rounded-pill transition-all duration-75 ${
                isPlaying && beat === i
                  ? i === 0
                    ? "bg-primary scale-125 shadow-lg shadow-primary/50"
                    : "bg-white scale-110"
                  : "bg-surface-hover"
              }`}
            />
          ))}
        </div>

        {/* BPM display */}
        <div className="text-center mb-6">
          <p className="text-7xl font-bold text-text tabular-nums">{bpm}</p>
          <p className="text-sm text-text-subtle mt-1">BPM</p>
        </div>

        <RoundRow className="mb-6">
          <RoundButton tone="tonal" size="lg" onClick={() => setBpm((b) => Math.max(40, b - 5))} aria-label="BPM 5 내리기">
            -5
          </RoundButton>
          <RoundButton tone="tonal" size="lg" onClick={() => setBpm((b) => Math.max(40, b - 1))} aria-label="BPM 1 내리기">
            -
          </RoundButton>
          <RoundButton
            tone={isPlaying ? "danger" : "primary"}
            size="hero"
            onClick={isPlaying ? stop : start}
            aria-label={isPlaying ? "메트로놈 정지" : "메트로놈 시작"}
          >
            <PlayPauseIcon playing={isPlaying} />
          </RoundButton>
          <RoundButton tone="tonal" size="lg" onClick={() => setBpm((b) => Math.min(300, b + 1))} aria-label="BPM 1 올리기">
            +
          </RoundButton>
          <RoundButton tone="tonal" size="lg" onClick={() => setBpm((b) => Math.min(300, b + 5))} aria-label="BPM 5 올리기">
            +5
          </RoundButton>
        </RoundRow>

        {/* Song selector */}
        {songs.length > 0 && (
          <div className="w-full max-w-xs">
            <select
              value={selectedSongId}
              onChange={(e) => handleSongChange(e.target.value)}
              className={`h-control-md rounded-control px-4 ${controlSkin(false)}`}
            >
              <option value="">곡 선택...</option>
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  {displayTitle(s.title)} ({s.tempo_bpm} BPM)
                </option>
              ))}
            </select>
            {selectedSong && (
              <p className="text-center text-caption text-text-subtle mt-2">
                현재: <span className="text-primary-fg">{displayTitle(selectedSong.title)}</span> · {selectedSong.tempo_bpm} BPM
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
