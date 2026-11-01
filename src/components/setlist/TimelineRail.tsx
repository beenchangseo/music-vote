import type { ReactNode } from "react";
import { formatRuntime } from "@/domain/setlist";
import { BLOCK_TONES, type BlockKind } from "./block-tones";

/** The axis column. The line halves and the node share it, so they stay on one vertical. */
const AXIS = "flex w-5 shrink-0";

interface RailCellProps {
  /** Block whose line comes down into this cell. */
  above?: BlockKind;
  /** Block whose line leaves this cell downward. */
  below?: BlockKind;
  node: string;
  children: ReactNode;
}

/**
 * The node and its label sit on the cell's vertical middle, and the line halves meet there.
 * The cell stretches to its block's row, so any card height keeps the time level with the card's middle.
 */
function RailCell({ above, below, node, children }: RailCellProps) {
  return (
    <div className="relative flex items-center">
      <span aria-hidden className={`${AXIS} absolute inset-y-0 left-0 flex-col items-center`}>
        <span className={`flex-1 ${above ? BLOCK_TONES[above].segment : ""}`} />
        <span className={`flex-1 ${below ? BLOCK_TONES[below].segment : ""}`} />
      </span>
      <span className="relative flex items-center">
        <span aria-hidden className={`${AXIS} justify-center`}>
          <span className={`rounded-pill ${node}`} />
        </span>
        {children}
      </span>
    </div>
  );
}

export function RailStart({ kind, previous, start }: { kind: BlockKind; previous?: BlockKind; start: number }) {
  const tone = BLOCK_TONES[kind];
  return (
    <RailCell above={previous} below={kind} node={tone.dot}>
      <span data-testid="rail-start" className={`whitespace-nowrap text-caption font-semibold tabular-nums ${tone.time}`}>
        {formatRuntime(start)}
      </span>
    </RailCell>
  );
}

export function RailEnd({ last, total }: { last: BlockKind; total: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem]">
      <div data-testid="rail-end" className="col-start-2 whitespace-nowrap text-caption">
        <span aria-hidden className={`${AXIS} h-4 justify-center`}>
          <span className={BLOCK_TONES[last].segment} />
        </span>
        <RailCell above={last} node="size-3.5 border-[3px] border-text bg-bg">
          <span className="font-bold tabular-nums text-text">{formatRuntime(total)}</span>
        </RailCell>
        <span className="flex">
          <span className={AXIS} />
          <span className="text-text-muted">끝</span>
        </span>
      </div>
    </div>
  );
}
