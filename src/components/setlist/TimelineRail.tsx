import { formatRuntime } from "@/domain/setlist";
import { BLOCK_TONES, type BlockKind } from "./block-tones";

const AXIS = "absolute left-3 -translate-x-1/2";

export function RailStart({ kind, previous, start }: { kind: BlockKind; previous?: BlockKind; start: number }) {
  const tone = BLOCK_TONES[kind];
  return (
    <div className="relative">
      {previous && <span aria-hidden className={`${AXIS} top-0 h-6.5 ${BLOCK_TONES[previous].segment}`} />}
      <span aria-hidden className={`${AXIS} top-6.5 bottom-0 ${tone.segment}`} />
      <span aria-hidden className={`${AXIS} top-6.5 -translate-y-1/2 rounded-pill ${tone.dot}`} />
      <span data-testid="rail-start" className={`absolute left-5.5 top-6.5 -translate-y-1/2 text-caption font-semibold tabular-nums ${tone.time}`}>
        {formatRuntime(start)}
      </span>
    </div>
  );
}

export function RailEnd({ last, total }: { last: BlockKind; total: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem]">
      <div className="relative col-start-2 h-16">
        <span aria-hidden className={`${AXIS} top-0 h-6.5 ${BLOCK_TONES[last].segment}`} />
        <span aria-hidden className={`${AXIS} top-6.5 size-3.5 -translate-y-1/2 rounded-pill border-[3px] border-text bg-bg`} />
        <span data-testid="rail-end" className="absolute left-5.5 top-4 whitespace-nowrap">
          <span className="block text-caption font-bold leading-5 tabular-nums text-text">{formatRuntime(total)}</span>
          <span className="block text-caption leading-4 text-text-muted">끝</span>
        </span>
      </div>
    </div>
  );
}
