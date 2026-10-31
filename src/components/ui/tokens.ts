/** WCAG 2.x contrast ratio of two opaque `#rrggbb` colors. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text needs 4.5:1. Borders, focus rings and icon-only marks need 3:1 (WCAG 1.4.11). */
export type Minimum = 4.5 | 3;

export interface Pairing {
  against: string;
  min: Minimum;
}

export interface ColorToken {
  name: string;
  hex: string;
  layer: "fg" | "bg";
  use: string;
  pairs: readonly Pairing[];
  avoid?: readonly Pairing[];
}

const SURFACES = ["bg", "surface", "surface-hover", "surface-elevated"] as const;
const onSurfaces = (min: Minimum, surfaces: readonly string[] = SURFACES): Pairing[] => surfaces.map((against) => ({ against, min }));

export const COLOR_GROUPS: readonly { title: string; note: string; tokens: readonly ColorToken[] }[] = [
  {
    title: "보라",
    note: "채움(primary)·글자(primary-fg)·tint 를 나눈다. 채운 보라 버튼은 화면에 하나.",
    tokens: [
      { name: "primary", hex: "#7c3aed", layer: "bg", use: "채움. 주 버튼, 켜진 스위치. 선택 테두리는 primary-fg", pairs: [{ against: "on-primary", min: 4.5 }] },
      { name: "primary-hover", hex: "#6d28d9", layer: "bg", use: "채움 hover", pairs: [{ against: "on-primary", min: 4.5 }] },
      { name: "primary-pressed", hex: "#5b21b6", layer: "bg", use: "채움 눌림", pairs: [{ against: "on-primary", min: 4.5 }] },
      { name: "on-primary", hex: "#ffffff", layer: "fg", use: "보라 채움 위 글자·아이콘", pairs: [] },
      {
        name: "primary-fg",
        hex: "#a78bfa",
        layer: "fg",
        use: "어두운 표면 위 보라 글자·아이콘·순위. 선택 상태 테두리",
        pairs: [...onSurfaces(4.5), { against: "primary-tint", min: 3 }],
      },
      {
        name: "primary-tint",
        hex: "#221d47",
        layer: "bg",
        use: "선택 칩·세그먼트·하단 탭·tonal 보라 바탕. 선택 칸은 primary-fg 테두리를 같이 쓴다",
        pairs: [
          { against: "on-primary-tint", min: 4.5 },
          { against: "text", min: 4.5 },
        ],
      },
      { name: "on-primary-tint", hex: "#c4b5fd", layer: "fg", use: "primary-tint 위 글자. primary-fg 글자의 hover", pairs: [] },
      { name: "focus-ring", hex: "#a78bfa", layer: "fg", use: "키보드 포커스 링", pairs: onSurfaces(3) },
    ],
  },
  {
    title: "상태",
    note: "빨강도 채움(danger)과 글자(danger-fg)를 나눈다.",
    tokens: [
      { name: "danger", hex: "#dc2626", layer: "bg", use: "채움. 되돌릴 수 없는 동작 버튼", pairs: [{ against: "on-danger", min: 4.5 }] },
      { name: "danger-hover", hex: "#b91c1c", layer: "bg", use: "빨강 채움 hover. danger/90 은 어두운 바탕에서 보이지 않았다", pairs: [{ against: "on-danger", min: 4.5 }] },
      { name: "on-danger", hex: "#ffffff", layer: "fg", use: "빨강 채움 위 글자", pairs: [] },
      { name: "danger-fg", hex: "#f87171", layer: "fg", use: "어두운 표면 위 빨강 글자·아이콘·오류 문구", pairs: onSurfaces(4.5) },
      { name: "danger-soft", hex: "#7f1d1d", layer: "bg", use: "빨강 옅은 바탕 (hover 등)", pairs: [{ against: "text", min: 4.5 }] },
      { name: "success", hex: "#22c55e", layer: "fg", use: "성공·찬성 글자와 아이콘", pairs: onSurfaces(4.5) },
      { name: "success-soft", hex: "#14532d", layer: "bg", use: "초록 옅은 바탕. 위에는 아이콘만", pairs: [{ against: "success", min: 3 }] },
      { name: "warning", hex: "#f59e0b", layer: "fg", use: "주의 글자와 아이콘", pairs: onSurfaces(4.5) },
      { name: "warning-soft", hex: "#78350f", layer: "bg", use: "주의 옅은 바탕. 위에는 아이콘만", pairs: [{ against: "warning", min: 3 }], avoid: [{ against: "warning", min: 4.5 }] },
      { name: "warning-tint", hex: "#352d23", layer: "bg", use: "주의 배지 바탕 (warning 16% on surface)", pairs: [{ against: "warning", min: 4.5 }, { against: "text", min: 4.5 }] },
      { name: "accent-play", hex: "#22d3ee", layer: "fg", use: "재생 중 표시 전용", pairs: onSurfaces(4.5) },
      { name: "kakao", hex: "#fee500", layer: "bg", use: "카카오 버튼 채움 전용", pairs: [{ against: "kakao-text", min: 4.5 }] },
      { name: "kakao-hover", hex: "#fdd800", layer: "bg", use: "카카오 버튼 hover", pairs: [{ against: "kakao-text", min: 4.5 }] },
      { name: "kakao-text", hex: "#191919", layer: "fg", use: "카카오 노랑 위 글자", pairs: [] },
    ],
  },
  {
    title: "표면",
    note: "깊이는 그림자 대신 표면 단계로 만든다. 한 단계씩만 쌓는다.",
    tokens: [
      { name: "bg", hex: "#030712", layer: "bg", use: "화면 바탕", pairs: [] },
      { name: "surface", hex: "#111827", layer: "bg", use: "카드·시트·다이얼로그", pairs: [] },
      { name: "surface-hover", hex: "#1f2937", layer: "bg", use: "tonal 버튼·칩·입력 채움·시트 안 묶음", pairs: [] },
      { name: "surface-elevated", hex: "#2a3441", layer: "bg", use: "토스트·팝오버·메뉴", pairs: [] },
    ],
  },
  {
    title: "글자와 테두리",
    note: "text-subtle 은 surface-elevated 위에 두지 않는다. 그 자리는 text-muted.",
    tokens: [
      { name: "text", hex: "#f3f4f6", layer: "fg", use: "본문·제목", pairs: onSurfaces(4.5) },
      { name: "text-muted", hex: "#9ca3af", layer: "fg", use: "보조 글자", pairs: onSurfaces(4.5) },
      {
        name: "text-subtle",
        hex: "#8a93a4",
        layer: "fg",
        use: "메타·placeholder",
        pairs: onSurfaces(4.5, ["bg", "surface", "surface-hover"]),
        avoid: [{ against: "surface-elevated", min: 4.5 }],
      },
      { name: "border", hex: "#374151", layer: "fg", use: "구분선. 입력 경계로 쓰지 않는다", pairs: [] },
      { name: "border-strong", hex: "#4b5563", layer: "fg", use: "강조 구분선", pairs: [] },
      {
        name: "border-input",
        hex: "#6b7280",
        layer: "fg",
        use: "입력칸 테두리",
        pairs: onSurfaces(3, ["bg", "surface", "surface-hover"]),
        avoid: [{ against: "surface-elevated", min: 3 }],
      },
    ],
  },
];

export const COLORS: ReadonlyMap<string, ColorToken> = new Map(COLOR_GROUPS.flatMap((g) => g.tokens).map((t) => [t.name, t]));

export interface ScaleToken {
  name: string;
  cssVar: string;
  value: string;
  utility: string;
  use: string;
}

export const TYPE: readonly ScaleToken[] = [
  { name: "display", cssVar: "--text-display", value: "2.5rem", utility: "text-display", use: "랜딩 큰 제목 40px" },
  { name: "h1", cssVar: "--text-h1", value: "1.875rem", utility: "text-h1", use: "화면 제목 30px" },
  { name: "h2", cssVar: "--text-h2", value: "1.5rem", utility: "text-h2", use: "섹션 제목 24px" },
  { name: "h3", cssVar: "--text-h3", value: "1.25rem", utility: "text-h3", use: "시트·카드 제목 20px" },
  { name: "h4", cssVar: "--text-h4", value: "1.125rem", utility: "text-h4", use: "작은 제목 18px" },
  { name: "body", cssVar: "--text-body", value: "1rem", utility: "text-body", use: "본문 16px" },
  { name: "sm", cssVar: "--text-sm", value: "0.875rem", utility: "text-sm", use: "보조 글자·버튼 14px" },
  { name: "caption", cssVar: "--text-caption", value: "0.75rem", utility: "text-caption", use: "메타 12px" },
];

export const RADII: readonly ScaleToken[] = [
  { name: "badge", cssVar: "--radius-badge", value: "0.375rem", utility: "rounded-badge", use: "배지 6px" },
  { name: "control", cssVar: "--radius-control", value: "0.75rem", utility: "rounded-control", use: "버튼·입력·칩 12px" },
  { name: "card", cssVar: "--radius-card", value: "1rem", utility: "rounded-card", use: "카드·다이얼로그 16px" },
  { name: "sheet", cssVar: "--radius-sheet", value: "1.5rem", utility: "rounded-t-sheet", use: "바텀시트 위 모서리 24px" },
  { name: "pill", cssVar: "--radius-pill", value: "9999px", utility: "rounded-pill", use: "알약·아바타" },
];

export const HEIGHTS: readonly ScaleToken[] = [
  { name: "control-sm", cssVar: "--spacing-control-sm", value: "2.25rem", utility: "h-control-sm", use: "작은 버튼 36px (누르는 영역 44px)" },
  { name: "control-md", cssVar: "--spacing-control-md", value: "2.75rem", utility: "h-control-md", use: "버튼·입력·칩 44px" },
  { name: "control-lg", cssVar: "--spacing-control-lg", value: "3.25rem", utility: "h-control-lg", use: "화면 아래 주 버튼 52px" },
  { name: "row", cssVar: "--spacing-row", value: "3.5rem", utility: "min-h-row", use: "설정·멤버 행 56px" },
  { name: "row-song", cssVar: "--spacing-row-song", value: "4.5rem", utility: "min-h-row-song", use: "곡 행 72px" },
];

export const SHADOWS: readonly ScaleToken[] = [
  { name: "float", cssVar: "--shadow-float", value: "0 12px 32px -8px rgb(0 0 0 / 0.6)", utility: "shadow-float", use: "시트·토스트·FAB 만" },
];

export const MOTION: readonly ScaleToken[] = [
  { name: "fast", cssVar: "", value: "120ms", utility: "duration-120", use: "누름" },
  { name: "base", cssVar: "--default-transition-duration", value: "200ms", utility: "duration-200", use: "색·페이드 (transition 기본값)" },
  { name: "slow", cssVar: "", value: "300ms", utility: "duration-300", use: "시트 등장" },
  { name: "standard", cssVar: "--ease-standard", value: "cubic-bezier(0.2, 0, 0, 1)", utility: "ease-standard", use: "모든 전환의 이징 (transition 기본값)" },
];
