"use client";

import { useState } from "react";

import type { SetlistItem } from "@/lib/types";

interface IntervalBlockProps {
  item: SetlistItem;
  index: number;
  total: number;
  /** 편집 모드일 때만 수정·순서·삭제 버튼을 그린다. 평소에는 곡 사이의 칩 하나다. */
  editMode: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * 곡 사이의 인터벌 (Spotify Mix 의 곡 사이 전환 칩). 곡은 행, 인터벌은 행 사이의 틈.
 * 같은 모양으로 그리면 둘이 구별되지 않는다.
 */
export default function IntervalBlock({ item, index, total, editMode, onEdit, onMoveUp, onMoveDown, onRemove }: IntervalBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = !!item.description || (item.label?.length || 0) > 30;
  const chip = (
    <>
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={expanded ? "" : "max-w-[11rem] truncate"}>{item.label || "인터벌"}</span>
      {item.duration_seconds > 0 && <span className="tabular-nums text-warning/80">· {formatTime(item.duration_seconds)}</span>}
      {canExpand && !editMode && (
        <svg className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </>
  );
  const chipClass =
    "inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-warning/30 bg-warning-soft/30 px-3 text-caption font-medium text-warning print:border-yellow-300 print:text-yellow-700";

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2 pl-[3.25rem]">
        {editMode && (
          <button onClick={onRemove} className="-ml-[3.25rem] flex h-11 w-11 shrink-0 items-center justify-center text-danger print:hidden" aria-label="삭제">
            <MinusCircle />
          </button>
        )}
        {editMode ? (
          <button type="button" onClick={onEdit} className={`${chipClass} min-w-0`} aria-label="인터벌 수정">
            {chip}
          </button>
        ) : canExpand ? (
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className={`${chipClass} min-w-0`}>
            {chip}
          </button>
        ) : (
          <span className={`${chipClass} min-w-0`}>{chip}</span>
        )}
        <span className="h-px flex-1 border-t border-dashed border-warning/30" aria-hidden />
        {editMode && (
          <div className="flex shrink-0 items-center print:hidden">
            <MoveButton direction="up" disabled={index === 0} onClick={onMoveUp} />
            <MoveButton direction="down" disabled={index === total - 1} onClick={onMoveDown} />
          </div>
        )}
      </div>
      {item.description && expanded && (
        <p className="mt-1 whitespace-pre-wrap pl-[3.25rem] text-caption leading-relaxed text-text-muted print:block print:text-yellow-700">
          {item.description}
        </p>
      )}
    </div>
  );
}

export function MinusCircle() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M8 12h8" />
    </svg>
  );
}

export function MoveButton({ direction, disabled, onClick }: { direction: "up" | "down"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
      aria-label={direction === "up" ? "위로" : "아래로"}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={direction === "up" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
    </button>
  );
}
