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

// ============================================================
// 아티스트 표기 정제
// ============================================================

/**
 * YouTube 채널명은 아티스트가 아닌 경우가 많다.
 * 실제 데이터에서 `YOUNHA - Topic`, `kwon.orca.archive`, `Mnet TV`,
 * `Pop music crooners of the 20th century`(채널 설명에 가깝다) 가 아티스트 자리에 들어왔다.
 *
 * 채널명을 다듬어 쓰고, 못 쓰겠으면 제목의 `아티스트 - 곡명` 앞부분을 쓴다.
 * 둘 다 아니면 null 을 돌려준다. 빈 줄이 틀린 줄보다 낫다.
 */

/** 자동 생성 채널과 배급사 접미사. */
const TOPIC_SUFFIX = /\s*[-–]\s*Topic\s*$/i;
const VEVO_SUFFIX = /\s*VEVO\s*$/;
/** 핸들처럼 생긴 것: 공백 없이 점으로 이어진 이름. */
const HANDLE_LIKE = /^[^\s]*\.[^\s]*$/;
/** 제목에서 아티스트를 떼어낼 구분자. 전각 대시도 받는다. */
const TITLE_SPLIT = /\s[-–—]\s/;

const MAX_ARTIST_LENGTH = 30;
const MAX_ARTIST_WORDS = 4;

function tidy(value: string): string {
  return value.replace(TOPIC_SUFFIX, "").replace(VEVO_SUFFIX, "").trim();
}

/** 사람 이름이나 팀 이름으로 보이는가. 설명문이나 핸들은 걸러낸다. */
function looksLikeArtist(value: string): boolean {
  if (!value) return false;
  if (value.length > MAX_ARTIST_LENGTH) return false;
  if (HANDLE_LIKE.test(value)) return false;
  if (value.split(/\s+/).length > MAX_ARTIST_WORDS) return false;
  return true;
}

/** 제목 앞부분에서 아티스트를 떼어낸다. `백예린 - La La La` → `백예린`. */
function artistFromTitle(title: string): string | null {
  // 선행 대괄호 태그는 아티스트가 아니다. `[MV] 가수 - 곡`
  const withoutTag = title.replace(/^\s*\[[^\]]*\]\s*/, "");
  const parts = withoutTag.split(TITLE_SPLIT);
  if (parts.length < 2) return null;
  const candidate = tidy(parts[0]);
  return looksLikeArtist(candidate) ? candidate : null;
}

/**
 * 화면에 보여줄 아티스트. 저장된 값은 건드리지 않고 표시할 때만 정제한다.
 * 되돌리기 쉽고 마이그레이션이 필요 없다.
 */
export function displayArtist(channel: string | null | undefined, title: string): string | null {
  // 제목을 먼저 본다. 업로더가 `아티스트 - 곡명` 으로 적어둔 자리라 채널명보다 정확하다.
  // 채널을 우선하면 `PLAY THAT K-POP`, `Mnet TV` 같은 재업로드 채널이 아티스트가 된다.
  const fromTitle = artistFromTitle(title);
  if (fromTitle) return fromTitle;

  const cleaned = channel ? tidy(channel) : "";
  return looksLikeArtist(cleaned) ? cleaned : null;
}
