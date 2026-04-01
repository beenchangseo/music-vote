"use client";

import Image from "next/image";
import type { PlayerState, PlayerActions } from "@/hooks/usePlayerQueue";
import type { YouTubePlayerHandle } from "./YouTubePlayer";

interface MiniPlayerProps {
  state: PlayerState;
  actions: PlayerActions;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
}

export default function MiniPlayer({ state, actions, playerRef }: MiniPlayerProps) {
  const { currentSong, isPlaying, repeatMode, shuffleMode, autoplayBlocked } = state;

  if (!currentSong) return null;

  function handlePlayPause() {
    if (autoplayBlocked) {
      // User gesture — try playing again
      playerRef.current?.play();
      actions.setAutoplayBlocked(false);
      return;
    }
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  }

  return (
    <div className="fixed bottom-[52px] left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 print:hidden">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        {/* Thumbnail */}
        {currentSong.thumbnail_url && (
          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
            <Image
              src={currentSong.thumbnail_url}
              alt={currentSong.title}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        )}

        {/* Song info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-100 truncate">{currentSong.title}</p>
          {currentSong.artist && (
            <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
          )}
        </div>

        {/* Autoplay blocked prompt */}
        {autoplayBlocked && (
          <button
            onClick={handlePlayPause}
            className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors shrink-0 animate-pulse"
          >
            탭하여 재생
          </button>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Shuffle */}
          <button
            onClick={actions.toggleShuffle}
            className={`p-2 rounded-full transition-colors ${
              shuffleMode ? "text-primary" : "text-gray-400 hover:text-gray-200"
            }`}
            aria-label={shuffleMode ? "셔플 끄기" : "셔플 켜기"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="p-2 rounded-full text-white hover:text-primary transition-colors"
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying && !autoplayBlocked ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={actions.playNext}
            className="p-2 rounded-full text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="다음 곡"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 4l10 8-10 8V4zm12 0h2v16h-2V4z" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            onClick={actions.toggleRepeat}
            className={`p-2 rounded-full transition-colors ${
              repeatMode === "one" ? "text-primary" : "text-gray-400 hover:text-gray-200"
            }`}
            aria-label={repeatMode === "one" ? "반복 끄기" : "한곡 반복"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 014-4h14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            {repeatMode === "one" && (
              <span className="absolute text-[8px] font-bold">1</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
