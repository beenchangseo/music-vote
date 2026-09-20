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
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-3 print:border-yellow-300 print:bg-yellow-50">
      <span className="text-caption text-text-subtle w-5 text-center shrink-0">{index + 1}</span>

      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-yellow-800/30 flex items-center justify-center shrink-0 print:bg-yellow-100">
        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`${expanded ? "" : "truncate"} text-sm font-medium text-yellow-200 print:whitespace-normal print:text-yellow-800`}>
          {item.label || "인터벌"}
        </p>
        {item.description && (
          <p className={`${expanded ? "whitespace-pre-wrap" : "line-clamp-2"} mt-0.5 text-caption leading-relaxed text-yellow-300/70 print:block print:whitespace-pre-wrap print:text-yellow-700`}>
            {item.description}
          </p>
        )}
        {item.duration_seconds > 0 && (
          <p className="text-caption text-yellow-400/70 print:text-yellow-600">
            {formatTime(item.duration_seconds)}
          </p>
        )}
      </div>

      {(canExpand || canEdit) && (
        <div className="flex basis-full items-center justify-between border-t border-yellow-700/20 pt-2 print:hidden">
          {canExpand ? (
            <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-11 text-caption text-yellow-400">
              {expanded ? "접기" : "펼치기"}
            </button>
          ) : <span />}
          {canEdit && <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-2.5 text-text-subtle hover:text-text" aria-label="인터벌 수정">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
            </button>
            <button onClick={onMoveUp} disabled={index === 0} className="p-2.5 text-text-subtle hover:text-text disabled:opacity-30 transition-colors" aria-label="위로">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={onMoveDown} disabled={index === total - 1} className="p-2.5 text-text-subtle hover:text-text disabled:opacity-30 transition-colors" aria-label="아래로">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={onRemove} className="min-h-11 min-w-11 text-danger" aria-label="삭제">×</button>
          </div>}
        </div>
      )}
    </div>
  );
}
