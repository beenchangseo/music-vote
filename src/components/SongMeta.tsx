"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useDialog } from "./DialogProvider";
import { updateSongMeta } from "@/actions/song";
import {
  KEY_ROOTS,
  KEY_MODES,
  GENRES,
  GENRE_LABEL,
  formatKey,
  formatDifficulty,
  formatDuration,
} from "@/lib/song-meta";
import type { SongWithScore, KeyRoot, KeyMode, Genre } from "@/lib/types";

interface SongMetaProps {
  song: SongWithScore;
  playlistId: string;
  shareCode: string;
  /** 메타 편집 토글 가능 여부. false면 read-only chips만. */
  editable?: boolean;
  /** 처음부터 펼쳐진 상태로 시작. RehearsalView처럼 항상 보이는 컨텍스트용. */
  defaultOpen?: boolean;
  /** chip이 wrap 되도록 하는지. compact 행 안에 들어갈 때 false 권장. */
  wrap?: boolean;
}

export default function SongMeta({
  song,
  playlistId,
  shareCode,
  editable = true,
  defaultOpen = false,
  wrap = true,
}: SongMetaProps) {
  const [open, setOpen] = useState(defaultOpen);
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
  const hasAny =
    !!keyRoot ||
    !!keyMemo ||
    !!tempoBpm ||
    !!durationMin ||
    !!durationSec ||
    !!difficulty ||
    !!genre;

  // ─── COLLAPSED (chips) ──────────────────────────────────────────
  if (!open) {
    return (
      <div className="px-3 py-2 border-b border-border">
        {hasAny ? (
          <div
            className={`flex items-center gap-1.5 ${
              wrap ? "flex-wrap" : "overflow-x-auto scrollbar-thin"
            }`}
          >
            <ChipGroup>
              {formatKey(keyRoot, keyMode) && (
                <Chip>{formatKey(keyRoot, keyMode)}</Chip>
              )}
              {!keyRoot && keyMemo && <Chip>{keyMemo}</Chip>}
              {hasBpm && <Chip>{tempoBpm} BPM</Chip>}
              {formatDuration(
                parseInt(durationMin || "0", 10) * 60 +
                  parseInt(durationSec || "0", 10),
              ) && (
                <Chip>
                  {formatDuration(
                    parseInt(durationMin || "0", 10) * 60 +
                      parseInt(durationSec || "0", 10),
                  )}
                </Chip>
              )}
              {difficulty && (
                <Chip aria-label={`난이도 ${difficulty}`}>
                  <span className="text-warning">
                    {formatDifficulty(difficulty)}
                  </span>
                </Chip>
              )}
              {genre && <Chip>{GENRE_LABEL[genre]}</Chip>}
            </ChipGroup>

            {editable && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="ml-auto shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-text-subtle hover:text-text hover:bg-surface-hover transition-colors"
                aria-label="메타 편집"
              >
                <PencilIcon />
              </button>
            )}
          </div>
        ) : editable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full text-left text-caption text-text-subtle hover:text-text-muted transition-colors py-1 inline-flex items-center gap-1"
          >
            <PlusIcon />
            메타 추가 (키·BPM·난이도…)
          </button>
        ) : (
          <p className="text-caption text-text-subtle py-1">메타 정보 없음</p>
        )}

        {/* 메트로놈 단축 (BPM 있고 닫힌 상태에서도 노출) */}
        {hasBpm && (
          <div className="mt-2">
            <Link
              href={`/playlist/${shareCode}/metronome?bpm=${tempoBpm}&songId=${song.id}`}
              className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline underline-offset-2"
            >
              <MetronomeIcon /> 메트로놈 {tempoBpm}
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ─── EXPANDED (editor) ─────────────────────────────────────────
  return (
    <div className="px-3 py-3 border-b border-border space-y-3 animate-fade-in">
      {/* 헤더: 닫기 + 저장 상태 */}
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold text-text-muted uppercase tracking-wider">
          메타 편집
        </span>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="inline-block w-3.5 h-3.5 border-2 border-text-subtle border-t-primary rounded-full animate-spin" />
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-caption text-text-muted hover:text-text inline-flex items-center gap-1"
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
          className="mt-2 w-full h-9 px-3 rounded-lg bg-surface border border-border text-caption text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="w-20 h-9 px-2 rounded-lg bg-surface border border-border text-caption text-text text-center focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="w-14 h-9 px-1 rounded-lg bg-surface border border-border text-caption text-text text-center focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="w-14 h-9 px-1 rounded-lg bg-surface border border-border text-caption text-text text-center focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {hasBpm && (
            <Link
              href={`/playlist/${shareCode}/metronome?bpm=${tempoBpm}&songId=${song.id}`}
              className="ml-auto inline-flex items-center gap-1 px-2.5 h-9 rounded-lg bg-primary/10 border border-primary/30 text-caption font-semibold text-primary hover:bg-primary/20"
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
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5 flex-wrap">{children}</div>;
}

function Chip({
  children,
  ...rest
}: {
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <span
      className="inline-flex items-center h-6 px-2 rounded-md bg-surface-hover text-caption font-medium text-text whitespace-nowrap"
      {...rest}
    >
      {children}
    </span>
  );
}

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
      className={`h-8 min-w-[36px] px-2.5 rounded-lg text-caption font-semibold transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-surface-hover text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
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
