"use client";

import Image from "next/image";
import type { SearchResult } from "@/lib/invidious";
import { formatDuration } from "@/lib/invidious";

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  isLoading: boolean;
  error: string | null;
  addingId: string | null;
}

export default function SearchResults({
  results,
  onSelect,
  isLoading,
  error,
  addingId,
}: SearchResultsProps) {
  if (error) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-red-900/20 border border-red-800/30 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 rounded-xl bg-gray-800/50 animate-pulse"
          >
            <div className="w-16 h-10 rounded-lg bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-700 rounded w-3/4" />
              <div className="h-2.5 bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-gray-800/50 p-1">
      {results.map((result) => (
        <button
          key={result.videoId}
          onClick={() => onSelect(result)}
          disabled={addingId === result.videoId}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-left disabled:opacity-50"
        >
          <div className="relative w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-700">
            <Image
              src={result.thumbnail}
              alt={result.title}
              fill
              sizes="64px"
              className="object-cover"
            />
            {result.lengthSeconds > 0 && (
              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 text-[10px] bg-black/80 text-white rounded">
                {formatDuration(result.lengthSeconds)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-100 truncate">{result.title}</p>
            <p className="text-xs text-gray-400 truncate">{result.author}</p>
          </div>
          <div className="shrink-0">
            {addingId === result.videoId ? (
              <span className="inline-block w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <span className="text-xs text-primary font-medium">추가</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
