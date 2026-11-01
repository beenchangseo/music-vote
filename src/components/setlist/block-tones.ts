import type { SetlistBlock } from "@/domain/setlist";

export type BlockKind = SetlistBlock<unknown>["kind"];

export const BLOCK_TONES: Record<BlockKind, { border: string; fill: string; segment: string; dot: string; time: string }> = {
  song: {
    border: "border-border",
    fill: "bg-surface",
    segment: "w-0.5 bg-border-strong",
    dot: "size-2.5 bg-text-muted ring-[3px] ring-bg",
    time: "text-text",
  },
  original: {
    border: "border-primary-fg/50",
    fill: "bg-primary-tint/45",
    segment: "w-0.5 bg-primary-fg/70",
    dot: "size-2.5 bg-primary-fg ring-[3px] ring-bg",
    time: "text-primary-fg",
  },
  interval: {
    border: "border-warning/45 print:border-yellow-300",
    fill: "bg-warning-tint/60 text-warning print:text-yellow-700",
    segment: "w-[3px] bg-warning",
    dot: "size-2.5 border-2 border-warning bg-bg",
    time: "text-warning",
  },
};
