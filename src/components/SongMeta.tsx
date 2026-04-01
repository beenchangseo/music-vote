"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useDialog } from "./DialogProvider";
import { updateSongMeta } from "@/actions/song";
import type { SongWithScore } from "@/lib/types";

interface SongMetaProps {
  song: SongWithScore;
  playlistId: string;
  shareCode: string;
}

export default function SongMeta({ song, playlistId, shareCode }: SongMetaProps) {
  const [keyMemo, setKeyMemo] = useState(song.key_memo || "");
  const [tempoBpm, setTempoBpm] = useState(song.tempo_bpm?.toString() || "");
  const [durationMin, setDurationMin] = useState(song.duration_seconds ? Math.floor(song.duration_seconds / 60).toString() : "");
  const [durationSec, setDurationSec] = useState(song.duration_seconds ? (song.duration_seconds % 60).toString() : "");
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleSave() {
    startTransition(async () => {
      try {
        const bpm = tempoBpm ? parseInt(tempoBpm) : null;
        const dur = (parseInt(durationMin || "0") * 60) + parseInt(durationSec || "0");
        await updateSongMeta(song.id, playlistId, shareCode, {
          keyMemo: keyMemo.trim() || null,
          tempoBpm: bpm && bpm >= 40 && bpm <= 300 ? bpm : null,
          durationSeconds: dur > 0 ? dur : null,
        });
      } catch {
        showAlert("저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="flex items-center gap-3">
        {/* Key */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">키</span>
          <input
            type="text"
            value={keyMemo}
            onChange={(e) => setKeyMemo(e.target.value)}
            onBlur={handleSave}
            placeholder="원키"
            className="w-16 px-2 py-1 rounded-md bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Tempo */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">BPM</span>
          <input
            type="number"
            value={tempoBpm}
            onChange={(e) => setTempoBpm(e.target.value)}
            onBlur={handleSave}
            placeholder="-"
            min={40}
            max={300}
            className="w-16 px-2 py-1 rounded-md bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {song.tempo_bpm && (
            <Link
              href={`/playlist/${shareCode}/metronome?bpm=${song.tempo_bpm}&songId=${song.id}`}
              className="p-1 text-primary hover:text-primary-hover transition-colors"
              title="메트로놈"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
          )}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">길이</span>
          <input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            onBlur={handleSave}
            placeholder="분"
            min={0}
            className="w-10 px-1 py-1 rounded-md bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-gray-600">:</span>
          <input
            type="number"
            value={durationSec}
            onChange={(e) => setDurationSec(e.target.value)}
            onBlur={handleSave}
            placeholder="초"
            min={0}
            max={59}
            className="w-10 px-1 py-1 rounded-md bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {isPending && (
          <span className="inline-block w-4 h-4 border-2 border-gray-600 border-t-primary rounded-full animate-spin shrink-0" />
        )}
      </div>
    </div>
  );
}
