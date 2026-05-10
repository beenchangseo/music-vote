// 곡 메타 상수 — 키/장르 라벨, 검증, BPM 버킷 등을 한 곳에 모음.

import type { Genre, KeyRoot, KeyMode } from "./types";

export const KEY_ROOTS: KeyRoot[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

export const KEY_MODES: { value: KeyMode; label: string }[] = [
  { value: "major", label: "Major" },
  { value: "minor", label: "minor" },
];

export const GENRES: { value: Genre; label: string }[] = [
  { value: "rock", label: "락" },
  { value: "pop", label: "팝" },
  { value: "ballad", label: "발라드" },
  { value: "indie", label: "인디" },
  { value: "punk", label: "펑크" },
  { value: "metal", label: "메탈" },
  { value: "jazz", label: "재즈" },
  { value: "hiphop", label: "힙합" },
  { value: "rnb", label: "R&B" },
  { value: "electronic", label: "일렉트로닉" },
  { value: "kpop", label: "K-Pop" },
  { value: "other", label: "기타" },
];

export const GENRE_LABEL: Record<Genre, string> = Object.fromEntries(
  GENRES.map((g) => [g.value, g.label]),
) as Record<Genre, string>;

export function formatKey(
  root: KeyRoot | null | undefined,
  mode: KeyMode | null | undefined,
): string | null {
  if (!root) return null;
  if (mode === "minor") return `${root}m`;
  return root;
}

export function formatDifficulty(d: number | null | undefined): string {
  if (!d) return "";
  return "★".repeat(d) + "☆".repeat(5 - d);
}

export function formatDuration(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 입력 검증/정규화
export function isValidKeyRoot(v: unknown): v is KeyRoot {
  return typeof v === "string" && (KEY_ROOTS as string[]).includes(v);
}

export function isValidKeyMode(v: unknown): v is KeyMode {
  return v === "major" || v === "minor";
}

export function isValidGenre(v: unknown): v is Genre {
  return typeof v === "string" && GENRES.some((g) => g.value === v);
}

export function isValidDifficulty(v: unknown): v is 1 | 2 | 3 | 4 | 5 {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}
