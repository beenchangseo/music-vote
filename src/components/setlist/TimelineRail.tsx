import type { ReactNode } from "react";
import { formatRuntime } from "@/domain/setlist";
import { BLOCK_TONES, type BlockKind } from "./block-tones";

const ROW = "grid grid-cols-[minmax(0,1fr)_3.5rem]";
const AXIS = "flex w-5 shrink-0 justify-center";
const EDGE_TICK_OVERHANG = "pt-[0.5lh]";

function EdgeTick({ node, children }: { node: string; children: ReactNode }) {
  return (
    <span className="relative flex h-0 items-center">
      <span aria-hidden className={AXIS}>
        <span className={`rounded-pill ${node}`} />
      </span>
      {children}
    </span>
  );
}

export function RailRow({ kind, start, current, children }: { kind: BlockKind; start: number; current: boolean; children: ReactNode }) {
  const tone = BLOCK_TONES[kind];
  return (
    <li className={`group/row ${ROW}`} aria-current={current ? "true" : undefined}>
      <div className="pb-2 group-last/row:pb-0">{children}</div>
      <div className="relative">
        <span aria-hidden className={`${AXIS} absolute inset-y-0 left-0`}>
          <span className={tone.segment} />
        </span>
        <EdgeTick node={tone.dot}>
          <span data-testid="rail-start" className={`whitespace-nowrap text-caption font-semibold tabular-nums ${tone.time}`}>
            {formatRuntime(start)}
          </span>
        </EdgeTick>
      </div>
    </li>
  );
}

export function RailEnd({ total }: { total: number }) {
  return (
    <div className={ROW}>
      <div data-testid="rail-end" className="col-start-2 whitespace-nowrap text-caption">
        <EdgeTick node="size-3.5 border-[3px] border-text bg-bg">
          <span className="font-bold tabular-nums text-text">{formatRuntime(total)}</span>
        </EdgeTick>
        <span className={`flex ${EDGE_TICK_OVERHANG}`}>
          <span className={AXIS} />
          <span className="text-text-muted">끝</span>
        </span>
      </div>
    </div>
  );
}
