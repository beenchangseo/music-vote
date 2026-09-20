"use client";

import { useState } from "react";

import type { SetlistItem } from "@/lib/types";

interface IntervalBlockProps {
  item: SetlistItem;
  index: number;
  total: number;
  canEdit: boolean;
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

export default function IntervalBlock({ item, index, total, canEdit, onEdit, onMoveUp, onMoveDown, onRemove }: IntervalBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = !!item.description || (item.label?.length || 0) > 30;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-1 print:border-y print:border-yellow-300">
      {/* 곡은 카드, 인터벌은 곡 사이의 틈. 같은 카드로 그리면 둘이 구별되지 않는다. */}
      <div className="flex w-full items-center gap-3">
        <span className="h-px flex-1 border-t border-dashed border-warning/40" aria-hidden />
        <span className="flex shrink-0 items-center gap-1.5 text-caption text-warning print:text-yellow-700">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={expanded ? "" : "truncate max-w-[10rem]"}>{item.label || "인터벌"}</span>
          {item.duration_seconds > 0 && (
            <span className="tabular-nums text-warning/80">· {formatTime(item.duration_seconds)}</span>
          )}
        </span>
        <span className="h-px flex-1 border-t border-dashed border-warning/40" aria-hidden />
      </div>

      {item.description && expanded && (
        <p className="w-full whitespace-pre-wrap text-caption leading-relaxed text-text-muted print:block print:text-yellow-700">
          {item.description}
        </p>
      )}

      {(canExpand || canEdit) && (
        <div className="flex basis-full items-center justify-between print:hidden">
          {canExpand ? (
            <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-11 text-caption text-yellow-400">
              {expanded ? "접기" : "펼치기"}
            </button>
          ) : <span />}
          {canEdit && <div className="flex items-center gap-1">
            <button onClick={onEdit} className="flex min-h-11 min-w-11 items-center justify-center text-text-subtle hover:text-text" aria-label="인터벌 수정">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
            </button>
            <button onClick={onMoveUp} disabled={index === 0} className="flex min-h-11 min-w-11 items-center justify-center text-text-subtle hover:text-text disabled:opacity-30 transition-colors" aria-label="위로">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={onMoveDown} disabled={index === total - 1} className="flex min-h-11 min-w-11 items-center justify-center text-text-subtle hover:text-text disabled:opacity-30 transition-colors" aria-label="아래로">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={onRemove} className="min-h-11 min-w-11 text-danger" aria-label="삭제">×</button>
          </div>}
        </div>
      )}
    </div>
  );
}
