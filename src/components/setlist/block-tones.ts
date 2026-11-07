import type { SetlistBlock } from "@/domain/setlist";

export type BlockKind = SetlistBlock<unknown>["kind"];

const CARD = "border bg-surface";
const SOLID = "w-0.5 bg-border-strong";

export const BLOCK_TONES: Record<BlockKind, { radius: string; card: string; segment: string; dot: string; time: string }> = {
  song: {
    radius: "rounded-card",
    card: `${CARD} border-border`,
    segment: SOLID,
    dot: "size-2.5 bg-text-muted ring-[3px] ring-bg",
    time: "text-text",
  },
  original: {
    radius: "rounded-card",
    card: `${CARD} border-border`,
    segment: SOLID,
    dot: "size-2.5 bg-primary-fg ring-[3px] ring-bg",
    time: "text-text",
  },
  interval: {
    radius: "rounded-control",
    // 곡 카드의 테두리 1px 만큼 가로로 들여 ⊖·시계가 곡 카드의 ⊖·커버와 같은 x 에 선다. 위아래에는 두지 않는다.
    // 편집 모드 한 줄 인터벌은 ⊖(size-control-sm, 36px)가 높이를 채워서, 위아래 테두리를 두면 38px 로 자란다.
    card: "border-x border-transparent bg-surface-hover text-text-muted",
    segment: "w-0 border-l-2 border-dashed border-text-subtle",
    dot: "size-2.5 border-2 border-text-muted bg-bg",
    time: "text-text-muted",
  },
};

export const PLAYING_CARD = `${CARD} border-primary-fg/60`;
