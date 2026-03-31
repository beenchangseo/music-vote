"use client";

import { useTransition } from "react";
import Image from "next/image";
import YouTubePlayer from "./YouTubePlayer";
import VoteButtons from "./VoteButtons";
import { removeSong } from "@/actions/song";
import type { SongWithScore } from "@/lib/types";

interface SongCardProps {
  song: SongWithScore;
  nickname: string;
  shareCode: string;
  playlistId: string;
  isAdmin: boolean;
  adminToken: string | null;
  viewMode: "card" | "compact";
  onVoteOptimistic?: (songId: string, scoreDelta: number) => void;
  isPlaying: boolean;
  onTogglePlay: (playing: boolean) => void;
  isExpired?: boolean;
}

export default function SongCard({
  song,
  nickname,
  shareCode,
  playlistId,
  isAdmin,
  adminToken,
  viewMode,
  onVoteOptimistic,
  isPlaying,
  onTogglePlay,
  isExpired = false,
}: SongCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    if (!adminToken || !confirm(`"${song.title}"을(를) 삭제하시겠습니까?`)) return;

    startTransition(async () => {
      try {
        await removeSong(song.id, playlistId, adminToken, shareCode);
      } catch {
        alert("곡 삭제에 실패했습니다.");
      }
    });
  }

  // Compact (playlist-style) view
  if (viewMode === "compact") {
    return (
      <div className={`bg-surface rounded-xl border border-border overflow-hidden transition-all hover:border-gray-600 ${isPending ? "opacity-50" : ""}`}>
        {isPlaying && (
          <YouTubePlayer videoId={song.youtube_video_id} title={song.title} autoLoad />
        )}
        <div className="flex items-center gap-3 p-3">
          {/* Thumbnail + play */}
          <button
            onClick={() => onTogglePlay(!isPlaying)}
            className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group"
            aria-label={`${song.title} ${isPlaying ? "닫기" : "재생"}`}
          >
            {song.thumbnail_url && (
              <Image
                src={song.thumbnail_url}
                alt={song.title}
                fill
                sizes="48px"
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
              {isPlaying ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </button>

          {/* Song info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm text-gray-100 truncate">{song.title}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {song.artist && (
                <span className="text-xs text-gray-400 truncate">{song.artist}</span>
              )}
              {song.added_by && (
                <>
                  {song.artist && <span className="text-xs text-gray-600">·</span>}
                  <span className="text-xs text-primary/70 truncate shrink-0">{song.added_by}</span>
                </>
              )}
            </div>
          </div>

          {/* Vote buttons */}
          <VoteButtons
            songId={song.id}
            score={song.score}
            userVote={song.userVote}
            nickname={nickname}
            shareCode={shareCode}
            onVoteOptimistic={onVoteOptimistic}
            disabled={isExpired}
          />

          {/* Admin delete */}
          {isAdmin && (
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="p-1.5 text-gray-600 hover:text-red-400 transition-colors shrink-0"
              aria-label="곡 삭제"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card (video) view
  return (
    <div className={`bg-surface rounded-2xl border border-border overflow-hidden transition-all hover:border-gray-600 ${isPending ? "opacity-50" : ""}`}>
      {isPlaying ? (
        <div className="relative">
          <YouTubePlayer videoId={song.youtube_video_id} title={song.title} autoLoad />
          <button
            onClick={() => onTogglePlay(false)}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            aria-label="영상 닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => onTogglePlay(true)}
          className="relative w-full aspect-video bg-gray-800 group"
          aria-label={`${song.title} 재생`}
        >
          {song.thumbnail_url && (
            <Image
              src={song.thumbnail_url}
              alt={song.title}
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-600 group-hover:bg-red-500 transition-colors shadow-lg">
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-100 truncate">{song.title}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {song.artist && (
                <span className="text-sm text-gray-400 truncate">{song.artist}</span>
              )}
              {song.added_by && (
                <>
                  {song.artist && <span className="text-sm text-gray-600">·</span>}
                  <span className="text-sm text-primary/70 shrink-0">{song.added_by} 추가</span>
                </>
              )}
            </div>
          </div>
          <VoteButtons
            songId={song.id}
            score={song.score}
            userVote={song.userVote}
            nickname={nickname}
            shareCode={shareCode}
            onVoteOptimistic={onVoteOptimistic}
            disabled={isExpired}
          />
        </div>

        {isAdmin && (
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="mt-3 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            곡 삭제
          </button>
        )}
      </div>
    </div>
  );
}
