"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useDialog } from "../ui/DialogProvider";
import SheetMusicLinks from "./SheetMusicLinks";
import { updateSongMeta } from "@/actions/song";
import { track } from "@/lib/analytics";
import { KEY_ROOTS, KEY_MODES, GENRES } from "@/domain/song-meta";
import type { SongWithScore, KeyRoot, KeyMode, Genre } from "@/domain/types";

interface SongMetaProps {
  song: SongWithScore;
  playlistId: string;
  shareCode: string;
  /** 접기. 요약은 바깥(합주 카드)이 그린다. */
  onClose: () => void;
}

export default function SongMeta({ song, playlistId, shareCode, onClose }: SongMetaProps) {
  const [keyRoot, setKeyRoot] = useState<KeyRoot | null>(song.key_root);
  const [keyMode, setKeyMode] = useState<KeyMode | null>(song.key_mode);
  const [keyMemo, setKeyMemo] = useState(song.key_memo || "");
  const [tempoBpm, setTempoBpm] = useState(song.tempo_bpm?.toString() || "");
  const [durationMin, setDurationMin] = useState(
    song.duration_seconds ? Math.floor(song.duration_seconds / 60).toString() : "",
  );
  const [durationSec, setDurationSec] = useState(
    song.duration_seconds ? (song.duration_seconds % 60).toString() : "",
  );
  const [difficulty, setDifficulty] = useState<number | null>(song.difficulty);
  const [genre, setGenre] = useState<Genre | null>(song.genre);
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function persist(patch: {
    keyRoot?: KeyRoot | null;
    keyMode?: KeyMode | null;
    keyMemo?: string | null;
    tempoBpm?: number | null;
    durationSeconds?: number | null;
    difficulty?: 1 | 2 | 3 | 4 | 5 | null;
    genre?: Genre | null;
  }) {
    // 분석: 어떤 메타 필드가 가장 자주 편집되는지 추적
    const fieldMap = {
      keyRoot: "key",
      keyMode: "key",
      keyMemo: "key_memo",
      tempoBpm: "bpm",
      durationSeconds: "duration",
      difficulty: "difficulty",
      genre: "genre",
    } as const;
    for (const k of Object.keys(patch) as (keyof typeof fieldMap)[]) {
      if (patch[k] !== undefined) {
        track("meta_edited", { field: fieldMap[k] });
        break;
      }
    }

    startTransition(async () => {
      try {
        await updateSongMeta(song.id, playlistId, shareCode, patch);
      } catch {
        showAlert("저장에 실패했습니다.");
      }
    });
  }

  function handleSaveAll() {
    const bpmNum = tempoBpm ? parseInt(tempoBpm, 10) : NaN;
    const dur =
      parseInt(durationMin || "0", 10) * 60 + parseInt(durationSec || "0", 10);
    persist({
      keyMemo: keyMemo.trim() || null,
      tempoBpm: Number.isFinite(bpmNum) && bpmNum >= 40 && bpmNum <= 300 ? bpmNum : null,
      durationSeconds: dur > 0 ? dur : null,
    });
  }

  const hasBpm = !!(tempoBpm && parseInt(tempoBpm, 10) >= 40);

  return (
    <div className="px-3 py-3 border-b border-border space-y-3 animate-fade-in">
      {/* 헤더: 닫기 + 저장 상태 */}
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold text-text-muted uppercase tracking-wider">
          메타 편집
        </span>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="inline-block w-3.5 h-3.5 border-2 border-text-subtle border-t-primary-fg rounded-full animate-spin" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-1 text-caption text-text-muted hover:text-text"
          >
            <ChevronUpIcon /> 접기
          </button>
        </div>
      </div>

      {/* Key picker */}
      <Field label="키">
        <div className="flex flex-wrap gap-1">
          <KeyChip
            active={keyRoot === null}
            onClick={() => {
              setKeyRoot(null);
              setKeyMode(null);
              persist({ keyRoot: null, keyMode: null });
            }}
          >
            없음
          </KeyChip>
          {KEY_ROOTS.map((k) => (
            <KeyChip
              key={k}
              active={keyRoot === k}
              onClick={() => {
                setKeyRoot(k);
                persist({ keyRoot: k });
              }}
            >
              {k}
            </KeyChip>
          ))}
        </div>
        {keyRoot && (
          <div className="mt-1.5 flex gap-1">
            {KEY_MODES.map((m) => (
              <KeyChip
                key={m.value}
                active={keyMode === m.value}
                onClick={() => {
                  const next = keyMode === m.value ? null : m.value;
                  setKeyMode(next);
                  persist({ keyMode: next });
                }}
              >
                {m.label}
              </KeyChip>
            ))}
          </div>
        )}
        <input
          type="text"
          value={keyMemo}
          onChange={(e) => setKeyMemo(e.target.value)}
          onBlur={handleSaveAll}
          placeholder="자유 메모 (예: 1키 다운, capo 2…)"
          className="mt-2 w-full h-11 px-3 rounded-control bg-surface border border-border text-caption text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring"
        />
      </Field>

      {/* BPM + Duration */}
      <Field label="BPM · 길이">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={tempoBpm}
            onChange={(e) => setTempoBpm(e.target.value)}
            onBlur={handleSaveAll}
            placeholder="BPM"
            min={40}
            max={300}
            className="w-20 h-11 px-2 rounded-control bg-surface border border-border text-caption text-text text-center focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <span className="text-caption text-text-subtle">·</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              onBlur={handleSaveAll}
              placeholder="분"
              min={0}
              className="w-14 h-11 px-1 rounded-control bg-surface border border-border text-caption text-text text-center focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
            <span className="text-caption text-text-subtle">:</span>
            <input
              type="number"
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              onBlur={handleSaveAll}
              placeholder="초"
              min={0}
              max={59}
              className="w-14 h-11 px-1 rounded-control bg-surface border border-border text-caption text-text text-center focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>
          {hasBpm && (
            <Link
              href={`/playlist/${shareCode}/metronome?bpm=${tempoBpm}&songId=${song.id}`}
              className="ml-auto inline-flex items-center gap-1 px-2.5 min-h-11 rounded-control bg-primary/10 border border-primary/30 text-caption font-semibold text-primary-fg hover:bg-primary/20"
            >
              <MetronomeIcon /> 메트로놈
            </Link>
          )}
        </div>
      </Field>

      {/* Difficulty */}
      <Field label="난이도">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((d) => (
            <KeyChip
              key={d}
              active={difficulty === d}
              onClick={() => {
                const next = difficulty === d ? null : d;
                setDifficulty(next);
                persist({ difficulty: next as 1 | 2 | 3 | 4 | 5 | null });
              }}
            >
              {"★".repeat(d)}
            </KeyChip>
          ))}
        </div>
      </Field>

      {/* Genre */}
      <Field label="장르">
        <div className="flex flex-wrap gap-1">
          {GENRES.map((g) => (
            <KeyChip
              key={g.value}
              active={genre === g.value}
              onClick={() => {
                const next = genre === g.value ? null : g.value;
                setGenre(next);
                persist({ genre: next });
              }}
            >
              {g.label}
            </KeyChip>
          ))}
        </div>
      </Field>

      {/* 외부 악보 검색 */}
      <SheetMusicLinks title={song.title} artist={song.artist} />
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-caption font-semibold text-text-muted mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function KeyChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 min-w-[44px] px-2.5 rounded-control text-caption font-semibold transition-colors ${
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-hover text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 15l-7-7-7 7" />
    </svg>
  );
}

function MetronomeIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2L8 22h8L12 2z" />
      <path d="M12 12l5-5" />
    </svg>
  );
}
