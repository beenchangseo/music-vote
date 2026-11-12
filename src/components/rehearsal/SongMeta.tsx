"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import Button, { buttonClassName } from "../ui/Button";
import Chip from "../ui/Chip";
import Input from "../ui/Input";
import { useDialog } from "../ui/DialogProvider";
import SheetMusicLinks from "./SheetMusicLinks";
import { updateSongMeta } from "@/actions/song";
import { track } from "@/lib/analytics";
import { KEY_ROOTS, KEY_MODES, GENRES } from "@/domain/song-meta";
import type { SongWithScore, KeyRoot, KeyMode, Genre } from "@/domain/types";
import { ChevronIcon, MetronomeIcon } from "@/components/ui/icons";

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
        showAlert("저장하지 못했어요");
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
        <span className="text-caption font-semibold text-text-muted">
          곡 정보
        </span>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="inline-block size-3.5 border-2 border-text-subtle border-t-primary-fg rounded-pill animate-spin" />
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronIcon direction="up" className="size-3.5" /> 접기
          </Button>
        </div>
      </div>

      {/* Key picker */}
      <Field label="키">
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          <Chip
            selected={keyRoot === null}
            onClick={() => {
              setKeyRoot(null);
              setKeyMode(null);
              persist({ keyRoot: null, keyMode: null });
            }}
          >
            없음
          </Chip>
          {KEY_ROOTS.map((k) => (
            <Chip
              key={k}
              selected={keyRoot === k}
              onClick={() => {
                setKeyRoot(k);
                persist({ keyRoot: k });
              }}
            >
              {k}
            </Chip>
          ))}
        </div>
        {keyRoot && (
          <div className="mt-2 flex gap-1.5">
            {KEY_MODES.map((m) => (
              <Chip
                key={m.value}
                selected={keyMode === m.value}
                onClick={() => {
                  const next = keyMode === m.value ? null : m.value;
                  setKeyMode(next);
                  persist({ keyMode: next });
                }}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        )}
        <Input
          value={keyMemo}
          onChange={(e) => setKeyMemo(e.target.value)}
          onBlur={handleSaveAll}
          placeholder="자유 메모 (예: 1키 다운, capo 2…)"
          aria-label="키 메모"
          className="mt-2"
        />
      </Field>

      {/* BPM + Duration */}
      <Field label="BPM · 길이">
        <div className="flex flex-wrap items-center gap-2">
          {/* Input is w-full, so its width comes from this box. */}
          <div className="w-20">
            <Input
              type="number"
              value={tempoBpm}
              onChange={(e) => setTempoBpm(e.target.value)}
              onBlur={handleSaveAll}
              placeholder="BPM"
              aria-label="BPM"
              min={40}
              max={300}
              compact
            />
          </div>
          <span className="text-caption text-text-subtle">·</span>
          <div className="flex items-center gap-1">
            <div className="w-14">
              <Input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                onBlur={handleSaveAll}
                placeholder="분"
                aria-label="길이 분"
                min={0}
                compact
              />
            </div>
            <span className="text-caption text-text-subtle">:</span>
            <div className="w-14">
              <Input
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                onBlur={handleSaveAll}
                placeholder="초"
                aria-label="길이 초"
                min={0}
                max={59}
                compact
              />
            </div>
          </div>
          {hasBpm && (
            <Link
              href={`/playlist/${shareCode}/metronome?bpm=${tempoBpm}&songId=${song.id}`}
              className={buttonClassName({ variant: "tonal", size: "sm", className: "ml-auto" })}
            >
              <MetronomeIcon className="size-3.5" /> 메트로놈
            </Link>
          )}
        </div>
      </Field>

      {/* Difficulty */}
      <Field label="난이도">
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          {[1, 2, 3, 4, 5].map((d) => (
            <Chip
              key={d}
              selected={difficulty === d}
              onClick={() => {
                const next = difficulty === d ? null : d;
                setDifficulty(next);
                persist({ difficulty: next as 1 | 2 | 3 | 4 | 5 | null });
              }}
            >
              {"★".repeat(d)}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Genre */}
      <Field label="장르">
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          {GENRES.map((g) => (
            <Chip
              key={g.value}
              selected={genre === g.value}
              onClick={() => {
                const next = genre === g.value ? null : g.value;
                setGenre(next);
                persist({ genre: next });
              }}
            >
              {g.label}
            </Chip>
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
