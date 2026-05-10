"use client";

import { useMemo, useState } from "react";
import { GENRES, KEY_ROOTS, KEY_MODES, GENRE_LABEL } from "@/lib/song-meta";
import type { KeyRoot, KeyMode, Genre } from "@/lib/types";

export type BpmBucket = "all" | "lt100" | "100-130" | "130-160" | "gt160";

export interface FilterState {
  bpm: BpmBucket;
  metaOnly: boolean;
  keyRoot: KeyRoot | null;
  keyMode: KeyMode | null;
  difficultyMax: number | null; // <= 이 값. null = 제한 없음
  genres: Genre[]; // empty = 전체
}

export const DEFAULT_FILTER: FilterState = {
  bpm: "all",
  metaOnly: false,
  keyRoot: null,
  keyMode: null,
  difficultyMax: null,
  genres: [],
};

const BPM_OPTIONS: { value: BpmBucket; label: string }[] = [
  { value: "all", label: "BPM 전체" },
  { value: "lt100", label: "< 100" },
  { value: "100-130", label: "100–130" },
  { value: "130-160", label: "130–160" },
  { value: "gt160", label: "160+" },
];

interface FilterBarProps {
  filter: FilterState;
  onChange: (next: FilterState) => void;
  total: number;
  visible: number;
}

function isFiltered(f: FilterState): boolean {
  return (
    f.bpm !== "all" ||
    f.metaOnly ||
    f.keyRoot !== null ||
    f.keyMode !== null ||
    f.difficultyMax !== null ||
    f.genres.length > 0
  );
}

function activeCount(f: FilterState): number {
  let n = 0;
  if (f.bpm !== "all") n++;
  if (f.metaOnly) n++;
  if (f.keyRoot || f.keyMode) n++;
  if (f.difficultyMax !== null) n++;
  if (f.genres.length > 0) n++;
  return n;
}

export default function FilterBar({
  filter,
  onChange,
  total,
  visible,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(() => isFiltered(filter), [filter]);
  const advCount = useMemo(() => {
    let n = 0;
    if (filter.keyRoot || filter.keyMode) n++;
    if (filter.difficultyMax !== null) n++;
    if (filter.genres.length > 0) n++;
    return n;
  }, [filter]);

  if (total === 0) return null;

  return (
    <div className="mt-3 pb-1">
      {/* horizontal chip strip — primary controls */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 scrollbar-thin">
        {BPM_OPTIONS.map((opt) => {
          const active = filter.bpm === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filter, bpm: opt.value })}
              className={`shrink-0 h-8 px-3 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "bg-surface border border-border text-text-muted hover:text-text"
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        <span className="shrink-0 w-px h-5 bg-border mx-1" aria-hidden />

        <button
          type="button"
          onClick={() => onChange({ ...filter, metaOnly: !filter.metaOnly })}
          className={`shrink-0 h-8 px-3 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
            filter.metaOnly
              ? "bg-primary text-white"
              : "bg-surface border border-border text-text-muted hover:text-text"
          }`}
          aria-pressed={filter.metaOnly}
        >
          메타 있음
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`shrink-0 h-8 px-3 rounded-full text-caption font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
            advCount > 0 || expanded
              ? "bg-primary/15 border border-primary/40 text-primary"
              : "bg-surface border border-border text-text-muted hover:text-text"
          }`}
        >
          더보기
          {advCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold">
              {advCount}
            </span>
          )}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {filtered && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTER)}
            className="shrink-0 h-8 px-3 rounded-full text-caption text-text-muted hover:text-text underline underline-offset-2"
          >
            초기화
          </button>
        )}
      </div>

      {/* expanded panel */}
      {expanded && (
        <div className="mt-3 p-4 rounded-2xl bg-surface border border-border space-y-4 animate-fade-in">
          {/* Key */}
          <div>
            <div className="text-caption font-semibold text-text-muted mb-2">
              키
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filter, keyRoot: null, keyMode: null })
                }
                className={`h-8 px-2.5 rounded-lg text-caption font-semibold transition-colors ${
                  !filter.keyRoot && !filter.keyMode
                    ? "bg-primary text-white"
                    : "bg-surface-hover text-text-muted hover:text-text"
                }`}
              >
                전체
              </button>
              {KEY_ROOTS.map((k) => {
                const active = filter.keyRoot === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filter,
                        keyRoot: active ? null : k,
                      })
                    }
                    className={`h-8 min-w-[36px] px-2 rounded-lg text-caption font-bold transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "bg-surface-hover text-text-muted hover:text-text"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            {filter.keyRoot && (
              <div className="mt-2 flex gap-1.5">
                {KEY_MODES.map((m) => {
                  const active = filter.keyMode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...filter,
                          keyMode: active ? null : m.value,
                        })
                      }
                      className={`h-7 px-3 rounded-md text-caption font-semibold transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "bg-surface-hover text-text-muted hover:text-text"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <div className="text-caption font-semibold text-text-muted mb-2">
              난이도 ≤
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onChange({ ...filter, difficultyMax: null })}
                className={`h-8 px-3 rounded-lg text-caption font-semibold transition-colors ${
                  filter.difficultyMax === null
                    ? "bg-primary text-white"
                    : "bg-surface-hover text-text-muted hover:text-text"
                }`}
              >
                전체
              </button>
              {[1, 2, 3, 4, 5].map((d) => {
                const active = filter.difficultyMax === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filter,
                        difficultyMax: active ? null : d,
                      })
                    }
                    className={`h-8 px-3 rounded-lg text-caption font-semibold transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "bg-surface-hover text-text-muted hover:text-text"
                    }`}
                  >
                    {"★".repeat(d)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genre — multi select */}
          <div>
            <div className="text-caption font-semibold text-text-muted mb-2">
              장르
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => {
                const active = filter.genres.includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? filter.genres.filter((x) => x !== g.value)
                        : [...filter.genres, g.value];
                      onChange({ ...filter, genres: next });
                    }}
                    className={`h-8 px-3 rounded-full text-caption font-semibold transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "bg-surface-hover text-text-muted hover:text-text"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* result count */}
      {filtered && (
        <p className="mt-2 px-1 text-caption text-text-subtle">
          <span className="text-text font-semibold">{visible}곡</span>
          <span className="mx-1">/</span>
          <span>전체 {total}곡</span>
          {activeCount(filter) > 0 && (
            <span className="ml-2 text-text-muted">
              · 필터 {activeCount(filter)}개
            </span>
          )}
        </p>
      )}
    </div>
  );
}

// 곡이 필터를 통과하는지
export function songMatchesFilter(
  song: {
    tempo_bpm: number | null;
    key_memo: string | null;
    key_root: KeyRoot | null;
    key_mode: KeyMode | null;
    difficulty: number | null;
    genre: Genre | null;
  },
  filter: FilterState,
): boolean {
  // BPM
  if (filter.bpm !== "all") {
    if (song.tempo_bpm == null) return false;
    const b = song.tempo_bpm;
    if (filter.bpm === "lt100" && !(b < 100)) return false;
    if (filter.bpm === "100-130" && !(b >= 100 && b <= 130)) return false;
    if (filter.bpm === "130-160" && !(b > 130 && b <= 160)) return false;
    if (filter.bpm === "gt160" && !(b > 160)) return false;
  }

  // 메타 있음 = key 또는 key_memo + tempo_bpm 둘 다 있음
  if (filter.metaOnly) {
    const hasKey = !!song.key_root || !!song.key_memo;
    if (!hasKey || song.tempo_bpm == null) return false;
  }

  // Key root
  if (filter.keyRoot && song.key_root !== filter.keyRoot) return false;
  // Key mode (root와 무관하게 mode만 필터링도 가능)
  if (filter.keyMode && song.key_mode !== filter.keyMode) return false;

  // Difficulty (해당 값 이하만 통과. 미설정 곡은 제외)
  if (filter.difficultyMax !== null) {
    if (song.difficulty == null || song.difficulty > filter.difficultyMax)
      return false;
  }

  // Genre (선택된 게 있으면 그 중 하나여야 함. 미설정 곡은 제외)
  if (filter.genres.length > 0) {
    if (!song.genre || !filter.genres.includes(song.genre)) return false;
  }

  return true;
}

// 곡 카드에서 메타 표시할 때 쓰는 formatter (편의)
export { GENRE_LABEL };
