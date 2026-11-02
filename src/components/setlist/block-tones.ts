import type { SetlistBlock } from "@/domain/setlist";

export type BlockKind = SetlistBlock<unknown>["kind"];

const CARD = "rounded-card border bg-surface";
const SOLID = "w-0.5 bg-border-strong";

export const BLOCK_TONES: Record<BlockKind, { card: string; segment: string; dot: string; time: string }> = {
  song: {
    card: `${CARD} border-border`,
    segment: SOLID,
    dot: "size-2.5 bg-text-muted ring-[3px] ring-bg",
    time: "text-text",
  },
  original: {
    card: `${CARD} border-border`,
    segment: SOLID,
    dot: "size-2.5 bg-primary-fg ring-[3px] ring-bg",
    time: "text-text",
  },
  interval: {
    card: "rounded-control bg-surface-hover text-text-muted",
    segment: "w-0 border-l-2 border-dashed border-text-subtle",
    dot: "size-2.5 border-2 border-text-muted bg-bg",
    time: "text-text-muted",
  },
};

export const PLAYING_CARD = `${CARD} border-primary-fg/60`;
