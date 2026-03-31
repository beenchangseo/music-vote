"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import NicknameModal from "./NicknameModal";
import PlaylistHeader from "./PlaylistHeader";
import AddSongForm from "./AddSongForm";
import SongCard from "./SongCard";
import type { Playlist, SongWithScore } from "@/lib/types";

interface VoteOverride {
  delta: number;
  baseScore: number;
}

interface PlaylistClientProps {
  playlist: Playlist;
  songs: SongWithScore[];
  shareCode: string;
}

export default function PlaylistClient({ playlist, songs, shareCode }: PlaylistClientProps) {
  const [nickname, setNickname] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "compact">("compact");
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [voteOverrides, setVoteOverrides] = useState<Record<string, VoteOverride>>({});
  const [resultCopied, setResultCopied] = useState(false);

  const [listParent] = useAutoAnimate({ duration: 300, easing: "ease-in-out" });

  const handleNickname = useCallback((name: string) => {
    setNickname(name);
  }, []);

  useEffect(() => {
    try {
      const myPlaylists = JSON.parse(localStorage.getItem("myPlaylists") || "[]");
      const found = myPlaylists.find((p: { id: string }) => p.id === playlist.id);
      setAdminToken(found?.adminToken || null);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = !!adminToken;

  // Deadline check
  const isExpired = playlist.deadline ? new Date(playlist.deadline) < new Date() : false;

  // Participant count (unique nicknames across all votes)
  const participantCount = useMemo(() => {
    const nicknames = new Set<string>();
    for (const song of songs) {
      for (const vote of song.votes) {
        nicknames.add(vote.nickname.toLowerCase());
      }
    }
    return nicknames.size;
  }, [songs]);

  const serverScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const song of songs) {
      map[song.id] = song.score;
    }
    return map;
  }, [songs]);

  const handleVoteOptimistic = useCallback((songId: string, scoreDelta: number) => {
    setVoteOverrides((prev) => {
      const existing = prev[songId];
      const currentServerScore = serverScoreMap[songId] ?? 0;
      if (existing && existing.baseScore === currentServerScore) {
        return { ...prev, [songId]: { delta: existing.delta + scoreDelta, baseScore: currentServerScore } };
      }
      return { ...prev, [songId]: { delta: scoreDelta, baseScore: currentServerScore } };
    });
  }, [serverScoreMap]);

  const songsWithUserVote = useMemo(() => {
    const mapped = songs.map((song) => {
      const override = voteOverrides[song.id];
      const effectiveDelta = override && override.baseScore === song.score ? override.delta : 0;
      return {
        ...song,
        score: song.score + effectiveDelta,
        userVote: nickname
          ? song.votes.find((v) => v.nickname.toLowerCase() === nickname.toLowerCase())?.vote_type ?? null
          : null,
      };
    });
    return mapped.sort((a, b) =>
      b.score - a.score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [songs, nickname, voteOverrides]);

  // Copy vote results as text
  async function handleShareResults() {
    const lines = songsWithUserVote.map((s, i) => `${i + 1}. ${s.title} (${s.score >= 0 ? "+" : ""}${s.score})`);
    const text = `${playlist.title} 투표 결과:\n${lines.join("\n")}\n\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      prompt("결과를 복사하세요:", text);
    }
  }

  return (
    <>
      <NicknameModal onSubmit={handleNickname} />

      <div className="min-h-full bg-gray-950">
        <div className="max-w-lg mx-auto px-4 py-6 pb-24">
          <PlaylistHeader
            playlistId={playlist.id}
            title={playlist.title}
            songCount={songs.length}
            shareCode={shareCode}
            isAdmin={isAdmin}
            adminToken={adminToken}
            participantCount={participantCount}
          />

          {/* Participant count + deadline info */}
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-gray-400">
            {participantCount > 0 && (
              <span>{participantCount}명 참여</span>
            )}
            {playlist.deadline && (
              <>
                {participantCount > 0 && <span className="text-gray-600">|</span>}
                <span className={isExpired ? "text-red-400" : "text-gray-400"}>
                  {isExpired ? "투표 마감" : `마감: ${new Date(playlist.deadline).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                </span>
              </>
            )}
          </div>

          {/* Add song form (hide if expired) */}
          {!isExpired && (
            <div className="mt-6">
              <AddSongForm playlistId={playlist.id} shareCode={shareCode} nickname={nickname} />
            </div>
          )}

          {nickname && (
            <p className="mt-4 text-sm text-gray-500 text-center">
              <span className="text-primary font-medium">{nickname}</span>
              (으)로 참여 중
            </p>
          )}

          {/* View mode toggle + results share */}
          {songsWithUserVote.length > 0 && (
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  {songs.length}곡
                </span>
                <button
                  onClick={handleShareResults}
                  className="text-xs text-gray-500 hover:text-primary transition-colors"
                >
                  {resultCopied ? "복사됨!" : "결과 공유"}
                </button>
              </div>
              <div className="flex bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "compact" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
                  }`}
                  aria-label="리스트 보기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "card" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
                  }`}
                  aria-label="카드 보기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Song list */}
          <div
            ref={listParent}
            className={`mt-3 ${viewMode === "compact" ? "space-y-2" : "space-y-4"}`}
          >
            {songsWithUserVote.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
                <p className="text-lg font-medium">아직 곡이 없습니다</p>
                <p className="mt-1">YouTube URL을 붙여넣어 곡을 추가해보세요</p>
              </div>
            ) : (
              songsWithUserVote.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  nickname={nickname}
                  shareCode={shareCode}
                  playlistId={playlist.id}
                  isAdmin={isAdmin}
                  adminToken={adminToken}
                  viewMode={viewMode}
                  onVoteOptimistic={handleVoteOptimistic}
                  isPlaying={activeSongId === song.id}
                  onTogglePlay={(playing) => setActiveSongId(playing ? song.id : null)}
                  isExpired={isExpired}
                />
              ))
            )}
          </div>

          {/* CTA: Create your own */}
          {songsWithUserVote.length > 0 && (
            <div className="mt-8 bg-surface border border-border rounded-2xl p-5 text-center">
              <p className="text-sm text-gray-400 mb-3">우리 밴드도 셋리스트를 투표로 정해보세요</p>
              <a
                href="/"
                className="inline-block px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all active:scale-95"
              >
                우리 밴드도 만들기
              </a>
            </div>
          )}

          {/* AdSense placeholder */}
          {songsWithUserVote.length > 0 && (
            <div className="mt-4 py-4 border border-dashed border-gray-700 rounded-xl text-center text-xs text-gray-600">
              광고 영역 (AdSense 승인 후 활성화)
            </div>
          )}
        </div>
      </div>
    </>
  );
}
