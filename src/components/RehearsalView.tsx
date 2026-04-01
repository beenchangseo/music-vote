"use client";

import { useMemo } from "react";
import Image from "next/image";
import SongMeta from "./SongMeta";
import CommentSection from "./CommentSection";
import type { SetlistItem, SongWithScore, Comment } from "@/lib/types";

interface RehearsalViewProps {
  setlistItems: SetlistItem[];
  songs: SongWithScore[];
  comments: Comment[];
  playlistId: string;
  shareCode: string;
  nickname: string;
  loading: boolean;
  onCommentsChange: (comments: Comment[]) => void;
}

export default function RehearsalView({
  setlistItems,
  songs,
  comments,
  playlistId,
  shareCode,
  nickname,
  loading,
  onCommentsChange,
}: RehearsalViewProps) {
  const songMap = useMemo(() => {
    const map: Record<string, SongWithScore> = {};
    for (const s of songs) map[s.id] = s;
    return map;
  }, [songs]);

  // Only song items from setlist
  const songItems = useMemo(
    () => [...setlistItems]
      .filter((i) => i.item_type === "song" && i.song_id)
      .sort((a, b) => a.position - b.position),
    [setlistItems]
  );

  if (loading) {
    return (
      <div className="mt-6 text-center py-16 text-gray-500">
        <span className="inline-block w-8 h-8 border-2 border-gray-600 border-t-primary rounded-full animate-spin" />
        <p className="mt-3">합주 정보 불러오는 중...</p>
      </div>
    );
  }

  if (songItems.length === 0) {
    return (
      <div className="mt-6 text-center py-16 text-gray-500">
        <p className="text-lg font-medium">합주 모드</p>
        <p className="mt-1 text-sm">셋리스트가 확정되면 곡별 키/템포/댓글을 관리할 수 있습니다</p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {songItems.map((item, index) => {
        const song = songMap[item.song_id!];
        if (!song) return null;

        const songComments = comments.filter((c) => c.song_id === song.id);

        return (
          <div key={item.id} className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* Song header */}
            <div className="flex items-center gap-3 p-3 border-b border-border">
              <span className="text-xs text-gray-500 w-5 text-center shrink-0">{index + 1}</span>
              {song.thumbnail_url && (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <Image src={song.thumbnail_url} alt={song.title} fill sizes="40px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-100 truncate">{song.title}</p>
                {song.artist && <p className="text-xs text-gray-400 truncate">{song.artist}</p>}
              </div>
            </div>

            {/* Song meta: key + tempo */}
            <SongMeta
              song={song}
              playlistId={playlistId}
              shareCode={shareCode}
            />

            {/* Comments */}
            <CommentSection
              songId={song.id}
              comments={songComments}
              nickname={nickname}
              shareCode={shareCode}
              onCommentsChange={onCommentsChange}
              allComments={comments}
            />
          </div>
        );
      })}
    </div>
  );
}
