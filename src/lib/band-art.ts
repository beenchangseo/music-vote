/**
 * 밴드 홈 그림의 색. 사진 없이도 밴드마다 다른 얼굴이 생기게 id 로 팔레트를 고른다
 * (Spotify Blend 의 겹친 원 그림처럼). 같은 밴드는 언제나 같은 색이다.
 * 무작위 hue 는 탁한 색이 나오기 쉬워서 어두운 배경에서 검증한 쌍만 쓴다.
 */

export interface BandPalette {
  /** 큰 원·버튼 강조. */
  strong: string;
  /** 겹치는 밝은 원. */
  light: string;
  /** 히어로 배경 위쪽 색 (아래로 bg 에 녹는다). */
  deep: string;
}

const PALETTES: BandPalette[] = [
  { strong: "#8b5cf6", light: "#f0abfc", deep: "#2e1065" },
  { strong: "#e11d48", light: "#fda4af", deep: "#4c0519" },
  { strong: "#2563eb", light: "#67e8f9", deep: "#172554" },
  { strong: "#0d9488", light: "#bef264", deep: "#042f2e" },
  { strong: "#ea580c", light: "#fcd34d", deep: "#431407" },
  { strong: "#4f46e5", light: "#7dd3fc", deep: "#1e1b4b" },
  { strong: "#c026d3", light: "#fdba74", deep: "#4a044e" },
  { strong: "#059669", light: "#a5f3fc", deep: "#022c22" },
];

/** 아바타 배경. 흰 글자가 읽히는 채도·명도만. */
const AVATAR_COLORS = ["#7c3aed", "#db2777", "#2563eb", "#0d9488", "#ea580c", "#4f46e5", "#c026d3", "#059669"];

/** 문자열 → 0 이상의 고정 정수 (FNV 비슷한 단순 해시, 보안 용도 아님). */
export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function bandPalette(teamId: string): BandPalette {
  return PALETTES[stableHash(teamId) % PALETTES.length];
}

/**
 * 한 밴드 멤버들의 아바타 색. 이름 해시로 자리를 잡고, 이미 쓴 색이면 다음 빈 색으로 넘긴다.
 * 그래서 8명까지는 한 화면에서 색이 겹치지 않는다 (그 뒤로는 다시 겹친다).
 */
export function assignAvatarColors(names: string[]): string[] {
  const used = new Set<number>();
  return names.map((name) => {
    let index = stableHash(name) % AVATAR_COLORS.length;
    if (used.size < AVATAR_COLORS.length) {
      while (used.has(index)) index = (index + 1) % AVATAR_COLORS.length;
    }
    used.add(index);
    return AVATAR_COLORS[index];
  });
}

/** 아바타 글자: 한글은 이름 첫 글자, 영문은 첫 글자 대문자. 빈 이름은 "?". */
export function avatarInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}
