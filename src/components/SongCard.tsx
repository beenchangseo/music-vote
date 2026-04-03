"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import YouTubePlayer from "./YouTubePlayer";
import VoteButtons from "./VoteButtons";
import CommentModal from "./CommentModal";
import { useDialog } from "./DialogProvider";
import { removeSong } from "@/actions/song";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
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
  isCurrent: boolean;
  onTogglePlay: () => void;
  isExpired?: boolean;
  isHighlighted?: boolean;
  playerRef?: React.RefObject<YouTubePlayerHandle | null>;
  onEnded?: () => void;
  onPlayerPlay?: () => void;
  onPlayerPause?: () => void;
  onAddToSetlist?: (songId: string) => void;
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
  isCurrent,
  onTogglePlay,
  isExpired = false,
  isHighlighted = false,
  playerRef,
  onEnded,
  onPlayerPlay,
  onPlayerPause,
  onAddToSetlist,
}: SongCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { showDanger, showAlert } = useDialog();

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function handleRemove() {
    if (!adminToken) return;
    const ok = await showDanger(`"${song.title}"을(를) 삭제하시겠습니까?`);
    if (!ok) return;

    startTransition(async () => {
      try {
        await removeSong(song.id, playlistId, adminToken, shareCode);
      } catch {
        showAlert("곡 삭제에 실패했습니다.");
      }
    });
  }

  // Compact (playlist-style) view
  if (viewMode === "compact") {
    return (
      <div className={`bg-surface rounded-xl border transition-all hover:border-gray-600 ${showMenu ? "overflow-visible" : "overflow-hidden"} ${isHighlighted ? "border-yellow-500/50 bg-yellow-900/5" : isCurrent ? "border-primary/50" : "border-border"} ${isPending ? "opacity-50" : ""}`}>
        {isCurrent && (
          <div className="relative">
            <YouTubePlayer
              ref={playerRef}
              videoId={song.youtube_video_id}
              onEnded={onEnded}
              onPlay={onPlayerPlay}
              onPause={onPlayerPause}
            />
            <button
              onClick={onTogglePlay}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              aria-label="영상 닫기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 p-3">
          {/* Thumbnail + play */}
          <button
            onClick={onTogglePlay}
            className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group"
            aria-label={`${song.title} ${isPlaying ? "일시정지" : "재생"}`}
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
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : isCurrent ? (
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
            {/* Playing indicator */}
            {isPlaying && (
              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                <span className="w-0.5 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-0.5 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-0.5 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </button>

          {/* Song info */}
          <div className="min-w-0 flex-1">
            <h3 className={`font-medium text-sm truncate ${isCurrent ? "text-primary" : "text-gray-100"}`}>{song.title}</h3>
            {song.artist && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{song.artist}</p>
            )}
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

          {/* More menu (⋮) */}
          <div className="relative shrink-0" ref={showMenu ? menuRef : undefined}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors"
              aria-label="더보기"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-20 w-44 bg-gray-800 border border-border rounded-xl shadow-lg overflow-hidden">
                {song.added_by && (
                  <div className="px-3 py-2 text-xs text-gray-500 border-b border-border truncate">
                    추가: <span className="text-gray-300">{song.added_by}</span>
                  </div>
                )}
                <button
                  onClick={() => { setShowComments(true); setShowMenu(false); }}
                  className="w-full px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  댓글
                </button>
                {onAddToSetlist && (
                  <button
                    onClick={() => { onAddToSetlist(song.id); setShowMenu(false); }}
                    className="w-full px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    셋리스트에 추가
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => { handleRemove(); setShowMenu(false); }}
                    disabled={isPending}
                    className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    곡 삭제
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {showComments && (
          <CommentModal
            songId={song.id}
            songTitle={song.title}
            nickname={nickname}
            shareCode={shareCode}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
    );
  }

  // Card (video) view
  return (
    <div className={`bg-surface rounded-2xl border overflow-hidden transition-all hover:border-gray-600 ${isCurrent ? "border-primary/50" : "border-border"} ${isPending ? "opacity-50" : ""}`}>
      {isCurrent ? (
        <div className="relative">
          <YouTubePlayer
            ref={playerRef}
            videoId={song.youtube_video_id}
            onEnded={onEnded}
            onPlay={onPlayerPlay}
            onPause={onPlayerPause}
          />
          <button
            onClick={onTogglePlay}
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
          onClick={onTogglePlay}
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
            <div className="w-14 h-14 flex items-center justify-center rounded-full shadow-lg bg-red-600 group-hover:bg-red-500 transition-colors">
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
            <h3 className={`font-semibold truncate ${isCurrent ? "text-primary" : "text-gray-100"}`}>{song.title}</h3>
            {song.artist && (
              <p className="text-sm text-gray-400 truncate mt-0.5">{song.artist}</p>
            )}
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

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setShowComments(true)}
            className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            댓글
          </button>
          {onAddToSetlist && (
            <button
              onClick={() => onAddToSetlist(song.id)}
              className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              셋리스트에 추가
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              곡 삭제
            </button>
          )}
        </div>
      </div>
      {showComments && (
        <CommentModal
          songId={song.id}
          songTitle={song.title}
          nickname={nickname}
          shareCode={shareCode}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}
