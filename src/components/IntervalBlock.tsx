"use client";

import type { SetlistItem } from "@/lib/types";

interface IntervalBlockProps {
  item: SetlistItem;
  index: number;
  total: number;
  isAdmin: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function IntervalBlock({ item, index, total, isAdmin, onMoveUp, onMoveDown, onRemove }: IntervalBlockProps) {
  return (
    <div className="bg-yellow-900/10 rounded-xl border border-yellow-700/30 p-3 flex items-center gap-3 print:bg-yellow-50 print:border-yellow-300">
      <span className="text-xs text-gray-500 w-5 text-center shrink-0">{index + 1}</span>

      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-yellow-800/30 flex items-center justify-center shrink-0 print:bg-yellow-100">
        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-yellow-200 truncate print:text-yellow-800">
          {item.label || "인터벌"}
        </p>
        {item.duration_seconds > 0 && (
          <p className="text-xs text-yellow-400/70 print:text-yellow-600">
            {formatTime(item.duration_seconds)}
          </p>
        )}
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0 print:hidden">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-200 disabled:opacity-30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-gray-500 hover:text-gray-200 disabled:opacity-30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button onClick={onRemove} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
