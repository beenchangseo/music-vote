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

  const hasBpm = !!(tempoBpm && parseInt(tempoBpm) >= 40);

  return (
    <div className="px-3 py-2 border-b border-border space-y-2">
      {/* Row 1: Key, BPM, Duration — enlarged touch targets */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 shrink-0">키</span>
          <input
            type="text"
            value={keyMemo}
            onChange={(e) => setKeyMemo(e.target.value)}
            onBlur={handleSave}
            placeholder="원키"
            className="w-14 px-2 py-2 rounded-lg bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 shrink-0">BPM</span>
          <input
            type="number"
            value={tempoBpm}
            onChange={(e) => setTempoBpm(e.target.value)}
            onBlur={handleSave}
            placeholder="-"
            min={40}
            max={300}
            className="w-16 px-2 py-2 rounded-lg bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 shrink-0">길이</span>
          <input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            onBlur={handleSave}
            placeholder="분"
            min={0}
            className="w-12 px-1 py-2 rounded-lg bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="w-12 px-1 py-2 rounded-lg bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {isPending && (
          <span className="inline-block w-4 h-4 border-2 border-gray-600 border-t-primary rounded-full animate-spin shrink-0" />
        )}
      </div>

      {/* Row 2: Metronome button */}
      <Link
        href={hasBpm ? `/playlist/${shareCode}/metronome?bpm=${tempoBpm}&songId=${song.id}` : "#"}
        onClick={(e) => { if (!hasBpm) { e.preventDefault(); showAlert("BPM을 먼저 입력해주세요."); } }}
        className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
          hasBpm
            ? "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
            : "bg-gray-800/50 border border-border text-gray-500 cursor-default"
        }`}
      >
        {/* Metronome icon */}
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L8 22h8L12 2z" />
          <path d="M12 12l5-5" />
        </svg>
        <span>{hasBpm ? `메트로놈 ${tempoBpm} BPM` : "메트로놈 (BPM 입력 필요)"}</span>
      </Link>
    </div>
  );
}
