"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Image from "next/image";
import Link from "next/link";
import { useDialog } from "./DialogProvider";
import NicknameModal from "./NicknameModal";
import LoginButton from "./LoginButton";
import PlaylistHeader from "./PlaylistHeader";
import AddSongForm from "./AddSongForm";
import SongCard from "./SongCard";
import MiniPlayer from "./MiniPlayer";
import NavigationBar from "./NavigationBar";
import SetlistView from "./SetlistView";
import RehearsalView from "./RehearsalView";
import { usePlayerQueue } from "@/hooks/usePlayerQueue";
import { getSetlistItems, confirmSetlist, addSongToSetlist } from "@/actions/setlist";
import { getComments } from "@/actions/comment";
import { track } from "@/lib/analytics";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
import FilterBar, {
  DEFAULT_FILTER,
  songMatchesFilter,
  type FilterState,
} from "./FilterBar";
import KakaoShareButton from "./KakaoShareButton";
import VotingModeToggle from "./VotingModeToggle";
import type { ViewMode } from "./NavigationBar";
import type { Playlist, SongWithScore, SetlistItem, Comment } from "@/lib/types";

interface VoteOverride {
  delta: number;
  baseScore: number;
}

interface PlaylistClientProps {
  playlist: Playlist;
  songs: SongWithScore[];
  shareCode: string;
  userNickname?: string;
  currentUserId?: string | null;
}

export default function PlaylistClient({ playlist, songs, shareCode, userNickname, currentUserId }: PlaylistClientProps) {
  // 신규(로그인 강제) 모드 vs 기존 익명 모드
  const requiresLogin = !!playlist.creator_user_id;
  const loggedIn = !!currentUserId;
  const loginGate = requiresLogin && !loggedIn;
  // 로그인 모드 + 로그인 사용자: 카카오 닉을 즉시 nickname 상태로 사용 (NicknameModal 스킵)
  const [nickname, setNickname] = useState(
    requiresLogin && loggedIn ? (userNickname || "") : ""
  );
  const [viewMode, setViewMode] = useState<"card" | "compact">("compact");
  const [navMode, setNavMode] = useState<ViewMode>("playlist");
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [voteOverrides, setVoteOverrides] = useState<Record<string, VoteOverride>>({});
  const [resultCopied, setResultCopied] = useState(false);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  // Lazy-loaded data for setlist/rehearsal modes
  const [setlistItems, setSetlistItems] = useState<SetlistItem[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingSetlist, setLoadingSetlist] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const { showConfirm, showAlert } = useDialog();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [listParent] = useAutoAnimate({ duration: 300, easing: "ease-in-out" });

  const handleNickname = useCallback((name: string) => {
    setNickname(name);
  }, []);

  useEffect(() => {
    try {
      const myPlaylists = JSON.parse(localStorage.getItem("myPlaylists") || "[]");
      const found = myPlaylists.find(
        (p: { id?: string; shareCode?: string }) => p.id === playlist.id || p.shareCode === shareCode
      );
      setAdminToken(found?.adminToken || null);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin 판정 우선순위:
  // 1) 로그인 모드 + 본인이 만든 플리 → creator_user_id 매칭
  // 2) 익명 모드 + nickname == creator_nickname (DB 기반)
  // 3) legacy adminToken fallback
  const isAdmin = playlist.creator_user_id
    ? !!currentUserId && currentUserId === playlist.creator_user_id
    : playlist.creator_nickname
      ? nickname.toLowerCase() === playlist.creator_nickname.toLowerCase()
      : !!adminToken;
  const isExpired = playlist.deadline ? new Date(playlist.deadline) < new Date() : false;

  // Lazy load setlist items on first mode switch
  const handleModeChange = useCallback(async (mode: ViewMode) => {
    setNavMode(mode);
    if (mode === "setlist" && setlistItems === null && !loadingSetlist) {
      setLoadingSetlist(true);
      try {
        const items = await getSetlistItems(playlist.id);
        setSetlistItems(items);
      } catch { /* ignore */ }
      setLoadingSetlist(false);
    }
    if (mode === "rehearsal" && comments === null && !loadingComments) {
      setLoadingComments(true);
      try {
        const [items, cmts] = await Promise.all([
          setlistItems === null ? getSetlistItems(playlist.id) : Promise.resolve(setlistItems),
          getComments(playlist.id),
        ]);
        if (setlistItems === null) setSetlistItems(items);
        setComments(cmts);
      } catch { /* ignore */ }
      setLoadingComments(false);
    }
  }, [playlist.id, setlistItems, comments, loadingSetlist, loadingComments]);

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

  const filteredSongs = useMemo(
    () => songsWithUserVote.filter((s) => songMatchesFilter(s, filter)),
    [songsWithUserVote, filter],
  );

  // Setlist highlight: top N songs after deadline
  const setlistCount = playlist.setlist_count;
  const highlightedSongIds = useMemo(() => {
    if (!isExpired || !setlistCount || setlistCount <= 0) return new Set<string>();
    return new Set(songsWithUserVote.slice(0, setlistCount).map((s) => s.id));
  }, [isExpired, setlistCount, songsWithUserVote]);

  // Player queue
  const { state: playerState, actions: playerActions } = usePlayerQueue(songsWithUserVote);

  // No need to call loadVideoById on song switch — each SongCard mounts
  // a fresh YouTubePlayer with the correct videoId prop when isCurrent becomes true.
  // loadVideoById is only used for repeat-one (same component stays mounted).

  const handleEnded = useCallback(() => {
    if (playerState.repeatMode === "one" && playerState.currentSong) {
      playerRef.current?.loadVideoById(playerState.currentSong.youtube_video_id);
    } else {
      playerActions.playNext();
    }
  }, [playerState.repeatMode, playerState.currentSong, playerActions]);

  const handleTogglePlay = useCallback((songId: string) => {
    if (playerState.currentSongId === songId) {
      playerActions.playSong("");
      playerActions.setIsPlaying(false);
    } else {
      playerActions.playSong(songId);
    }
  }, [playerState.currentSongId, playerActions]);

  // Setlist add confirm dialog
  const [setlistConfirmSongId, setSetlistConfirmSongId] = useState<string | null>(null);
  const setlistConfirmSong = setlistConfirmSongId ? songsWithUserVote.find((s) => s.id === setlistConfirmSongId) : null;

  const handleAddToSetlist = useCallback((songId: string) => {
    setSetlistConfirmSongId(songId);
  }, []);

  async function handleConfirmAddToSetlist() {
    if (!setlistConfirmSongId) return;
    try {
      const item = await addSongToSetlist(playlist.id, setlistConfirmSongId, shareCode);
      setSetlistItems((prev) => prev ? [...prev, item] : [item]);
      setSetlistConfirmSongId(null);
    } catch {
      showAlert("셋리스트 추가에 실패했습니다.");
    }
  }

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

  // Bottom padding: NavigationBar(52px) + MiniPlayer(~56px if active)
  const bottomPadding = playerState.currentSongId ? "pb-32" : "pb-16";

  return (
    <>
      {!requiresLogin && (
        <NicknameModal
          onSubmit={handleNickname}
          defaultNickname={userNickname}
          existingNicknames={Array.from(new Set(songs.flatMap((s) => [
            ...s.votes.map((v) => v.nickname),
            ...(s.added_by ? [s.added_by] : []),
          ])))}
        />
      )}

      <div className="min-h-full bg-gray-950">
        <div className={`max-w-lg mx-auto px-4 py-6 ${bottomPadding}`}>
          <PlaylistHeader
            playlistId={playlist.id}
            title={playlist.title}
            songCount={songs.length}
            shareCode={shareCode}
            isAdmin={isAdmin}
            adminToken={adminToken}
            participantCount={participantCount}
            announcement={playlist.announcement}
          />

          {/* Invitation banner — login-required playlist, viewed by anonymous visitor */}
          {loginGate && (
            <div className="mt-4 flex items-center gap-3 bg-[#FEE500]/10 border border-[#FEE500]/40 rounded-xl px-3 py-2.5 animate-fade-in">
              <p className="flex-1 min-w-0 text-sm text-text leading-tight truncate">
                <span className="font-semibold">{playlist.creator_nickname || "친구"}</span>
                님이 초대했어요
              </p>
              <LoginButton size="sm" label="카카오 로그인" />
            </div>
          )}

          {/* Participant count + deadline info */}
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-text-muted">
            {participantCount > 0 && (
              <span>{participantCount}명 참여</span>
            )}
            {playlist.deadline && (
              <>
                {participantCount > 0 && <span className="text-gray-600">|</span>}
                <span className={isExpired ? "text-red-400" : "text-text-muted"}>
                  {isExpired ? "투표 마감" : `마감: ${new Date(playlist.deadline).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                </span>
              </>
            )}
          </div>

          {/* Admin-only: 투표 모드 토글 */}
          {isAdmin && adminToken && (
            <div className="mt-3 flex justify-center">
              <VotingModeToggle
                playlistId={playlist.id}
                shareCode={shareCode}
                adminToken={adminToken}
                votesAnonymous={playlist.votes_anonymous}
              />
            </div>
          )}

          {nickname && (
            <p className="mt-4 text-sm text-text-subtle text-center">
              <span className="text-primary font-medium">{nickname}</span>
              (으)로 참여 중
            </p>
          )}

          {/* YouTube Player is rendered inline inside SongCard */}

          {/* === MODE: PLAYLIST === */}
          {navMode === "playlist" && (
            <>
              {/* Add song form (hide if expired) */}
              {!isExpired && (
                <div className="mt-6">
                  <AddSongForm playlistId={playlist.id} shareCode={shareCode} nickname={nickname} loginGate={loginGate} />
                </div>
              )}

              {/* Result share banner — voting closed + has top song */}
              {isExpired && songsWithUserVote.length > 0 && (
                <div className="mt-5 p-5 rounded-2xl bg-success/10 border border-success/30 text-center animate-fade-in">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/20 text-success text-caption font-bold mb-3">
                    🎉 곡 결정
                  </div>
                  <p className="text-h3 font-bold text-text leading-snug truncate px-2">
                    {songsWithUserVote[0].title}
                  </p>
                  {songsWithUserVote[0].artist && (
                    <p className="text-sm text-text-muted truncate mt-1 mb-4 px-2">
                      {songsWithUserVote[0].artist}
                    </p>
                  )}
                  {songsWithUserVote[0].score > 0 && (
                    <p className="text-caption text-text-muted mb-4">
                      +{songsWithUserVote[0].score}점 1위 ·{" "}
                      {participantCount > 0
                        ? `${participantCount}명 참여`
                        : `${songs.length}곡 후보`}
                    </p>
                  )}
                  <KakaoShareButton
                    shareCode={shareCode}
                    variant="decided"
                    title={playlist.title}
                    songs={songs.length}
                    participants={participantCount}
                    topSong={songsWithUserVote[0].title}
                    topArtist={songsWithUserVote[0].artist || undefined}
                    topScore={Math.max(0, songsWithUserVote[0].score)}
                    visualStyle="primary"
                    size="md"
                  >
                    카톡 단톡방에 결과 공유
                  </KakaoShareButton>
                </div>
              )}

              {/* Setlist confirmation banner */}
              {isExpired && setlistCount && !playlist.setlist_confirmed && (
                <div className="mt-5 p-4 bg-primary/10 border border-primary/30 rounded-xl text-center">
                  <p className="text-sm text-gray-200 mb-2">
                    투표가 마감되었습니다. 상위 {setlistCount}곡이 하이라이트됩니다.
                  </p>
                  {isAdmin ? (
                    <button
                      onClick={async () => {
                        const topSongIds = songsWithUserVote.slice(0, setlistCount).map((s) => s.id);
                        if (!adminToken) return;
                        const ok = await showConfirm(`상위 ${setlistCount}곡으로 셋리스트를 확정하시겠습니까?`);
                        if (!ok) return;
                        try {
                          await confirmSetlist(playlist.id, adminToken, topSongIds, shareCode);
                          track("setlist_confirmed", {
                            song_count: topSongIds.length,
                            auto: false,
                          });
                        } catch {
                          showAlert("셋리스트 확정에 실패했습니다.");
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all active:scale-95"
                    >
                      셋리스트 확정하기
                    </button>
                  ) : (
                    <p className="text-xs text-text-muted">생성자가 셋리스트를 확정하면 셋리스트/합주 모드를 사용할 수 있습니다.</p>
                  )}
                </div>
              )}

              {/* Setlist share banner — confirmed setlist */}
              {playlist.setlist_confirmed && (
                <div className="mt-5 p-5 rounded-2xl bg-primary/10 border border-primary/30 text-center animate-fade-in">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-caption font-bold mb-3">
                    🎵 셋리스트 확정
                  </div>
                  <p className="text-sm text-text mb-4">
                    총 {setlistCount || songsWithUserVote.length}곡 · 다음 공연 준비 완료
                  </p>
                  <KakaoShareButton
                    shareCode={shareCode}
                    variant="setlist"
                    title={playlist.title}
                    songs={songs.length}
                    participants={participantCount}
                    setlistCount={setlistCount || songsWithUserVote.length}
                    visualStyle="primary"
                    size="md"
                  >
                    셋리스트 카톡 공유
                  </KakaoShareButton>
                </div>
              )}

              {/* View mode toggle + results share */}
              {songsWithUserVote.length > 0 && (
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-subtle uppercase tracking-wider font-semibold">
                      {songs.length}곡
                    </span>
                    <button
                      onClick={handleShareResults}
                      className="text-xs text-text-subtle hover:text-primary transition-colors"
                    >
                      {resultCopied ? "복사됨!" : "결과 공유"}
                    </button>
                  </div>
                  <div className="flex bg-surface-hover rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode("compact")}
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === "compact" ? "bg-gray-600 text-white" : "text-text-muted hover:text-gray-200"
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
                        viewMode === "card" ? "bg-gray-600 text-white" : "text-text-muted hover:text-gray-200"
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

              {/* Filter bar */}
              <FilterBar
                filter={filter}
                onChange={(next) => {
                  // 새로 활성화된 필터 차원만 트래킹
                  if (next.bpm !== "all" && next.bpm !== filter.bpm) {
                    track("filter_applied", { type: "bpm" });
                  }
                  if (next.metaOnly && !filter.metaOnly) {
                    track("filter_applied", { type: "meta_only" });
                  }
                  if (next.keyRoot && next.keyRoot !== filter.keyRoot) {
                    track("filter_applied", { type: "key" });
                  }
                  if (
                    next.difficultyMax !== null &&
                    next.difficultyMax !== filter.difficultyMax
                  ) {
                    track("filter_applied", { type: "difficulty" });
                  }
                  if (next.genres.length > filter.genres.length) {
                    track("filter_applied", { type: "genre" });
                  }
                  setFilter(next);
                }}
                total={songsWithUserVote.length}
                visible={filteredSongs.length}
              />

              {/* Song list */}
              <div
                ref={listParent}
                className={`mt-3 ${viewMode === "compact" ? "space-y-2" : "space-y-4"}`}
              >
                {songsWithUserVote.length === 0 ? (
                  <div className="mt-2 rounded-2xl border-2 border-dashed border-border bg-surface/40 px-6 py-10 text-center">
                    {/* 위 입력창을 가리키는 화살표 + 음표 */}
                    <div className="flex items-center justify-center gap-2 mb-5 text-primary animate-bounce-slow">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 11l7-7 7 7M5 19l7-7 7 7"
                        />
                      </svg>
                      <span className="text-sm font-semibold">위 입력창부터</span>
                    </div>

                    <p className="text-h3 font-bold text-text mb-2">
                      첫 곡을 추가해보세요
                    </p>
                    <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
                      YouTube 링크를 붙여넣으면<br />
                      제목·썸네일이 자동으로 들어가요.
                    </p>

                    <div className="mt-6 flex flex-col gap-1.5 text-caption text-text-subtle">
                      <p>곡 3개 이상 → 멤버에게 카톡으로 공유</p>
                      <p>5분 안에 다음 합주곡 결정 끝.</p>
                    </div>
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <div className="mt-2 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-8 text-center">
                    <p className="text-sm text-text-muted">
                      필터에 맞는 곡이 없어요.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilter(DEFAULT_FILTER)}
                      className="mt-2 text-caption text-primary hover:underline underline-offset-2"
                    >
                      필터 초기화
                    </button>
                  </div>
                ) : (
                  filteredSongs.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      votesAnonymous={playlist.votes_anonymous}
                      nickname={nickname}
                      shareCode={shareCode}
                      playlistId={playlist.id}
                      isAdmin={isAdmin}
                      adminToken={adminToken}
                      viewMode={viewMode}
                      onVoteOptimistic={handleVoteOptimistic}
                      isPlaying={playerState.currentSongId === song.id && playerState.isPlaying}
                      isCurrent={playerState.currentSongId === song.id}
                      onTogglePlay={() => handleTogglePlay(song.id)}
                      isExpired={isExpired}
                      isHighlighted={highlightedSongIds.has(song.id)}
                      playerRef={playerState.currentSongId === song.id ? playerRef : undefined}
                      onEnded={playerState.currentSongId === song.id ? handleEnded : undefined}
                      onPlayerPlay={playerState.currentSongId === song.id ? () => playerActions.setIsPlaying(true) : undefined}
                      onPlayerPause={playerState.currentSongId === song.id ? () => playerActions.setIsPlaying(false) : undefined}
                      onAddToSetlist={handleAddToSetlist}
                      loginGate={loginGate}
                    />
                  ))
                )}
              </div>

              {/* CTA: Create your own */}
              {songsWithUserVote.length > 0 && (
                <div className="mt-8 bg-surface border border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-text-muted mb-3">새로운 플레이리스트를 만들고 싶다면?</p>
                  <Link
                    href="/"
                    className="inline-block px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all active:scale-95"
                  >
                    플레이리스트 만들기
                  </Link>
                </div>
              )}
            </>
          )}

          {/* === MODE: SETLIST === */}
          {navMode === "setlist" && (
            <SetlistView
              setlistItems={setlistItems || []}
              songs={songsWithUserVote}
              playlistId={playlist.id}
              shareCode={shareCode}
              isAdmin={isAdmin}
              adminToken={adminToken}
              loading={loadingSetlist}
              onItemsChange={setSetlistItems}
              title={playlist.title}
              participantCount={participantCount}
            />
          )}

          {/* === MODE: REHEARSAL === */}
          {navMode === "rehearsal" && (
            <RehearsalView
              setlistItems={setlistItems || []}
              songs={songsWithUserVote}
              comments={comments || []}
              playlistId={playlist.id}
              shareCode={shareCode}
              nickname={nickname}
              loading={loadingComments}
              onCommentsChange={setComments}
            />
          )}
        </div>
      </div>

      {/* Setlist add confirm dialog */}
      {setlistConfirmSong && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 px-4 pb-28">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              {setlistConfirmSong.thumbnail_url && (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={setlistConfirmSong.thumbnail_url}
                    alt={setlistConfirmSong.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{setlistConfirmSong.title}</p>
                {setlistConfirmSong.artist && (
                  <p className="text-xs text-text-muted truncate">{setlistConfirmSong.artist}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-300 text-center mb-4">셋리스트에 추가할까요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSetlistConfirmSongId(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-hover hover:bg-gray-700 text-sm text-gray-300 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmAddToSetlist}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm text-white font-semibold transition-all active:scale-95"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini Player (positioned above NavigationBar via CSS bottom-[52px]) */}
      <MiniPlayer
        state={playerState}
        actions={playerActions}
        playerRef={playerRef}
      />

      {/* Navigation Bar */}
      <NavigationBar
        mode={navMode}
        onModeChange={handleModeChange}
      />
    </>
  );
}
