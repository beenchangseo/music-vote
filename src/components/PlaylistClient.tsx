"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Image from "next/image";
import Link from "next/link";
import { useDialog } from "./DialogProvider";
import LoginButton from "./LoginButton";
import PlaylistHeader from "./PlaylistHeader";
import AddSongForm from "./AddSongForm";
import SongCard from "./SongCard";
import MiniPlayer from "./MiniPlayer";
import YouTubePlayer from "./YouTubePlayer";
import NavigationBar from "./NavigationBar";
import SetlistView from "./SetlistView";
import RehearsalView from "./RehearsalView";
import { usePlayerQueue } from "@/hooks/usePlayerQueue";
import { usePlaylistVotes } from "@/hooks/usePlaylistVotes";
import { usePlaylistRealtime } from "@/hooks/usePlaylistRealtime";
import { getSetlistItems, confirmSetlist, addSongToSetlist } from "@/actions/setlist";
import { getComments } from "@/actions/comment";
import { track } from "@/lib/analytics";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
import { DEFAULT_FILTER, songMatchesFilter, type FilterState } from "./FilterBar";
import KakaoShareButton from "./KakaoShareButton";
import RoomSettingsButton from "./RoomSettingsButton";
import ScreenToolbar from "./ui/ScreenToolbar";
import VoteAllowanceStatus from "./VoteAllowanceStatus";
import { registerPlaylistMember } from "@/actions/member";
import type { ViewMode } from "./NavigationBar";
import { scoreRatio } from "@/lib/vote-domain";
import { isArchivedPlaylist } from "@/lib/playlist-archive";
import type { Playlist, SongWithScore, SetlistItem, Comment, VoteAllowance } from "@/lib/types";

interface PlaylistClientProps {
  playlist: Playlist;
  songs: SongWithScore[];
  shareCode: string;
  participantCount: number;
  userNickname?: string;
  currentUserId?: string | null;
  currentUserAvatarUrl?: string | null;
}

export default function PlaylistClient({ playlist, songs, shareCode, participantCount, userNickname, currentUserId, currentUserAvatarUrl }: PlaylistClientProps) {
  // 보관된 합주방: 로그인 도입 전 익명 합주방. 지난 기록만 읽는다.
  const isArchived = isArchivedPlaylist(playlist);
  const loggedIn = !!currentUserId;
  const loginGate = !isArchived && !loggedIn;
  // 닉네임은 카카오 프로필에서 그대로 쓴다.
  const nickname = !isArchived && loggedIn ? userNickname || "" : "";
  const [viewMode, setViewMode] = useState<"card" | "compact">("compact");
  const [navMode, setNavMode] = useState<ViewMode>("playlist");
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [allowance, setAllowance] = useState<VoteAllowance | null>(null);
  const [votesAnonymous, setVotesAnonymous] = useState(playlist.votes_anonymous);
  const [setlistEditMode, setSetlistEditMode] = useState(playlist.setlist_edit_mode);

  // Lazy-loaded data for setlist/rehearsal modes
  const [setlistItems, setSetlistItems] = useState<SetlistItem[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingSetlist, setLoadingSetlist] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const { showConfirm, showAlert } = useDialog();
  const router = useRouter();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [listParent] = useAutoAnimate({ duration: 300, easing: "ease-in-out" });

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
  // 보관된 합주방에서 방장 표시는 남은 링크 토큰으로만 판정한다. 방 삭제에만 쓴다.
  const isAdmin = isArchived
    ? !!adminToken
    : !!currentUserId && currentUserId === playlist.creator_user_id;
  const isExpired = playlist.deadline ? new Date(playlist.deadline) < new Date() : false;
  const canEditSetlist = !isArchived && !loginGate && (setlistEditMode === "everyone" || isAdmin);

  useEffect(() => {
    if (isArchived || !loggedIn) return;
    registerPlaylistMember(playlist.id).then(setAllowance).catch(() => {
      showAlert("참여자 등록에 실패했습니다. 새로고침 후 다시 시도해주세요.");
    });
  }, [isArchived, loggedIn, playlist.id, showAlert]);

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

  // 다른 참여자의 변경 알림. 셋리스트·댓글은 서버 렌더가 아니라
  // 클라이언트가 따로 받아둔 값이라 이미 열어본 목록만 다시 받아온다.
  const handleRemoteChange = useCallback(() => {
    router.refresh();
    if (setlistItems !== null) {
      getSetlistItems(playlist.id).then(setSetlistItems).catch(() => undefined);
    }
    if (comments !== null) {
      getComments(playlist.id).then(setComments).catch(() => undefined);
    }
  }, [router, playlist.id, setlistItems, comments]);

  const { notifyChange } = usePlaylistRealtime(shareCode, handleRemoteChange);

  const handleAllowanceChange = useCallback((usedVotes: number, voteLimit: number) => {
    setAllowance((current) => (current ? { ...current, usedVotes, voteLimit } : current));
  }, []);

  const { songsWithVotes, pressVote, isVotePending, resetVotes } = usePlaylistVotes({
    songs,
    votingMode: playlist.voting_mode,
    shareCode,
    nickname,
    allowance,
    onAllowanceChange: handleAllowanceChange,
    onError: showAlert,
    onSaved: notifyChange,
  });

  const filteredSongs = useMemo(
    () => songsWithVotes.filter((s) => songMatchesFilter(s, filter)),
    [songsWithVotes, filter],
  );

  // 순위와 막대는 필터 전 전체 순위를 기준으로 한다.
  // 필터를 걸었다고 4위가 1위로 보이면 안 된다.
  //
  // 번호는 상위 세 행까지만 붙인다. 점수가 5,5,4,4,4,4 처럼 몰리면
  // 등수로만 자를 때 3등이 예닐곱 개가 되어 번호가 소음이 된다.

  const topScore = songsWithVotes[0]?.score ?? 0;

  // Setlist highlight: top N songs after deadline
  const setlistCount = playlist.setlist_count;
  const highlightedSongIds = useMemo(() => {
    if (!isExpired || !setlistCount || setlistCount <= 0) return new Set<string>();
    return new Set(songsWithVotes.slice(0, setlistCount).map((s) => s.id));
  }, [isExpired, setlistCount, songsWithVotes]);

  // Player queue
  const { state: playerState, actions: playerActions } = usePlayerQueue(songsWithVotes);

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
      // 큐를 비우면 플레이어가 언마운트돼 모바일 자동 재생 허용이 풀린다.
      // 멈출 때도 플레이어는 남겨두고 일시정지만 한다.
      if (playerState.isPlaying) playerRef.current?.pause();
      else playerRef.current?.play();
    } else {
      playerActions.playSong(songId);
    }
  }, [playerState.currentSongId, playerState.isPlaying, playerActions]);

  // Setlist add confirm dialog
  const [setlistConfirmSongId, setSetlistConfirmSongId] = useState<string | null>(null);
  const setlistConfirmSong = setlistConfirmSongId ? songsWithVotes.find((s) => s.id === setlistConfirmSongId) : null;

  const handleAddToSetlist = useCallback((songId: string) => {
    setSetlistConfirmSongId(songId);
  }, []);

  async function handleConfirmAddToSetlist() {
    if (!setlistConfirmSongId) return;
    try {
      const item = await addSongToSetlist(playlist.id, adminToken, setlistConfirmSongId, shareCode);
      setSetlistItems((prev) => prev ? [...prev, item] : [item]);
      setSetlistConfirmSongId(null);
      notifyChange();
    } catch {
      showAlert("셋리스트 추가에 실패했습니다.");
    }
  }

  // 한 줄 메타. 있는 것만 가운뎃점으로 잇는다.
  const metaParts: { key: string; text: string; className: string }[] = [];
  if (loginGate) {
    metaParts.push({
      key: "invite",
      text: `${playlist.creator_nickname || "친구"}님이 초대했어요`,
      className: "text-text",
    });
  }
  if (participantCount > 0) {
    metaParts.push({ key: "participants", text: `${participantCount}명 참여`, className: "" });
  }
  if (playlist.deadline) {
    metaParts.push({
      key: "deadline",
      text: isExpired
        ? "투표 마감"
        : `마감 ${new Date(playlist.deadline).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      className: isExpired ? "text-danger" : "",
    });
  }
  if (nickname) {
    metaParts.push({ key: "me", text: `${nickname}으로 참여 중`, className: "text-text-subtle" });
  }

  // Bottom padding: NavigationBar(52px) + MiniPlayer(~56px if active)
  const bottomPadding = playerState.currentSongId ? "pb-32" : "pb-16";

  /*
    방 설정은 화면 설정이 아니라 방 설정이다. 투표 공개 범위도, 셋리스트 편집 권한도
    playlists 행에 붙어 있다. 그래서 진입점을 하나로 두고 세 화면 툴바의 같은 자리에 건다.
    종전에는 후보곡·합주에 떠 있는 톱니, 셋리스트에 전체 폭 토글 박스로 흩어져 있었다.
  */
  const settingsButton = isAdmin && !isArchived ? (
    <RoomSettingsButton
      playlistId={playlist.id}
      shareCode={shareCode}
      adminToken={adminToken}
      supportsVoteAllocation
      currentUserId={currentUserId}
      setlistEditMode={setlistEditMode}
      onSetlistEditModeChange={setSetlistEditMode}
      onAllowanceChange={(mode, usedVotes, voteLimit) => setAllowance({ mode, usedVotes, voteLimit })}
      onVotesAnonymousChange={(next) => {
        setVotesAnonymous(next);
        notifyChange();
      }}
      onVotesReset={() => {
        resetVotes();
        notifyChange();
      }}
    />
  ) : null;

  return (
    <>
      <div className="min-h-full bg-bg">
        <div className={`max-w-lg mx-auto px-4 py-6 ${bottomPadding}`}>
          <PlaylistHeader
            playlistId={playlist.id}
            title={playlist.title}
            songCount={songs.length}
            shareCode={shareCode}
            participantCount={participantCount}
            announcement={playlist.announcement}
            currentUserNickname={userNickname}
            currentUserAvatarUrl={currentUserAvatarUrl}
          />

          {isArchived && (
            <div className="mt-3 rounded-lg border border-border bg-surface/60 px-3 py-2 animate-fade-in" role="status">
              <p className="text-caption leading-relaxed text-text-muted">
                <span className="font-semibold text-text">보관된 합주방이에요.</span>{" "}
                지난 투표 결과와 셋리스트는 그대로 볼 수 있지만, 새로 투표하거나 곡을 추가할 수는 없어요.
              </p>
              <Link
                href="/"
                className="mt-1.5 inline-flex min-h-11 items-center text-caption font-semibold text-primary hover:underline underline-offset-2"
              >
                새 합주방 만들기 →
              </Link>
            </div>
          )}

          {/*
            참여자 수·마감·내 닉네임·로그인이 세 덩어리로 흩어져 있었다.
            정렬축이 계속 바뀌어 위계가 읽히지 않았으므로 헤더 바로 아래 한 줄로 합친다.
          */}
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-caption leading-relaxed text-text-muted tabular-nums">
              {metaParts.map((part, i) => (
                <span key={part.key}>
                  {i > 0 && <span className="mx-1.5 text-text-subtle" aria-hidden>·</span>}
                  <span className={part.className}>{part.text}</span>
                </span>
              ))}
            </p>
            {loginGate && (
              <LoginButton
                size="sm"
                label="로그인"
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-control border border-border px-3 text-caption font-semibold text-text-muted transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-text"
              />
            )}
          </div>

          {/* YouTube Player is rendered inline inside SongCard */}

          {/* === MODE: PLAYLIST === */}
          {navMode === "playlist" && (
            <>
              <ScreenToolbar
                stat={`${songs.length}곡`}
                caption={<VoteAllowanceStatus allowance={allowance} />}
                actions={
                  <>
                    {songsWithVotes.length > 0 && (
                      <div className="-mr-0.5 flex rounded-control bg-surface p-0.5">
                        <button
                          onClick={() => setViewMode("compact")}
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-control transition-colors ${
                            viewMode === "compact"
                              ? "bg-surface-elevated text-text shadow-sm"
                              : "text-text-muted hover:text-text"
                          }`}
                          aria-label="리스트 보기"
                          aria-pressed={viewMode === "compact"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setViewMode("card")}
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-control transition-colors ${
                            viewMode === "card"
                              ? "bg-surface-elevated text-text shadow-sm"
                              : "text-text-muted hover:text-text"
                          }`}
                          aria-label="카드 보기"
                          aria-pressed={viewMode === "card"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {settingsButton}
                  </>
                }
              />

              {/* Add song form (hide if expired) */}
              {!isExpired && !isArchived && (
                <div className="mt-6">
                  <AddSongForm playlistId={playlist.id} shareCode={shareCode} loginGate={loginGate} onAdded={notifyChange} />
                </div>
              )}

              {/* Result share banner — voting closed + has top song */}
              {isExpired && songsWithVotes.length > 0 && (
                <div className="mt-5 p-5 rounded-2xl bg-success/10 border border-success/30 text-center animate-fade-in">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/20 text-success text-caption font-bold mb-3">
                    🎉 곡 결정
                  </div>
                  <p className="text-h3 font-bold text-text leading-snug truncate px-2">
                    {songsWithVotes[0].title}
                  </p>
                  {songsWithVotes[0].artist && (
                    <p className="text-sm text-text-muted truncate mt-1 mb-4 px-2">
                      {songsWithVotes[0].artist}
                    </p>
                  )}
                  {songsWithVotes[0].score > 0 && (
                    <p className="text-caption text-text-muted mb-4">
                      +{songsWithVotes[0].score}점 1위 ·{" "}
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
                    topSong={songsWithVotes[0].title}
                    topArtist={songsWithVotes[0].artist || undefined}
                    topScore={Math.max(0, songsWithVotes[0].score)}
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
                  <p className="text-sm text-text mb-2">
                    투표가 마감되었습니다. 상위 {setlistCount}곡이 하이라이트됩니다.
                  </p>
                  {isAdmin ? (
                    <button
                      onClick={async () => {
                        const topSongIds = songsWithVotes.slice(0, setlistCount).map((s) => s.id);
                        if (!adminToken) return;
                        const ok = await showConfirm(`상위 ${setlistCount}곡으로 셋리스트를 확정하시겠습니까?`);
                        if (!ok) return;
                        try {
                          await confirmSetlist(playlist.id, adminToken, topSongIds, shareCode);
                          track("setlist_confirmed", {
                            song_count: topSongIds.length,
                            auto: false,
                          });
                          notifyChange();
                        } catch {
                          showAlert("셋리스트 확정에 실패했습니다.");
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all active:scale-95"
                    >
                      셋리스트 확정하기
                    </button>
                  ) : (
                    <p className="text-caption text-text-muted">생성자가 셋리스트를 확정하면 셋리스트/합주 모드를 사용할 수 있습니다.</p>
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
                    총 {setlistCount || songsWithVotes.length}곡 · 다음 공연 준비 완료
                  </p>
                  <KakaoShareButton
                    shareCode={shareCode}
                    variant="setlist"
                    title={playlist.title}
                    songs={songs.length}
                    participants={participantCount}
                    setlistCount={setlistCount || songsWithVotes.length}
                    visualStyle="primary"
                    size="md"
                  >
                    셋리스트 카톡 공유
                  </KakaoShareButton>
                </div>
              )}

              {/* Song list */}
              <div
                ref={listParent}
                className={`mt-3 ${viewMode === "compact" ? "space-y-2" : "space-y-4"}`}
              >
                {songsWithVotes.length === 0 ? (
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
                      votingMode={playlist.voting_mode}
                      votesAnonymous={votesAnonymous}
                      nickname={nickname}
                      shareCode={shareCode}
                      playlistId={playlist.id}
                      isAdmin={isAdmin}
                      adminToken={adminToken}
                      viewMode={viewMode}
                      scoreRatio={scoreRatio(song.score, topScore)}
                      onVotePress={pressVote}
                      votePending={isVotePending(song.id)}
                      isPlaying={playerState.currentSongId === song.id && playerState.isPlaying}
                      isCurrent={playerState.currentSongId === song.id}
                      onTogglePlay={() => handleTogglePlay(song.id)}
                      isExpired={isExpired}
                      isHighlighted={highlightedSongIds.has(song.id)}
                      onAddToSetlist={canEditSetlist ? handleAddToSetlist : undefined}
                      loginGate={loginGate}
                      currentUserId={currentUserId}
                    />
                  ))
                )}
              </div>

            </>
          )}

          {/* === MODE: SETLIST === */}
          {navMode === "setlist" && (
            <SetlistView
              setlistItems={setlistItems || []}
              songs={songsWithVotes}
              playlistId={playlist.id}
              shareCode={shareCode}
              adminToken={adminToken}
              loading={loadingSetlist}
              onItemsChange={(items) => {
                setSetlistItems(items);
                notifyChange();
              }}
              title={playlist.title}
              canEdit={canEditSetlist}
              actions={settingsButton}
            />
          )}

          {/* === MODE: REHEARSAL === */}
          {navMode === "rehearsal" && (
            <RehearsalView
              setlistItems={setlistItems || []}
              songs={songsWithVotes}
              comments={comments || []}
              playlistId={playlist.id}
              shareCode={shareCode}
              nickname={nickname}
              loading={loadingComments}
              onCommentsChange={(next) => {
                setComments(next);
                notifyChange();
              }}
              actions={settingsButton}
            />
          )}

          {/* CTA: Create your own — 페이지 가장 아래 (모든 모드 공통, 곡이 있을 때만) */}
          {songsWithVotes.length > 0 && (
            <div className="mt-10 mb-4 text-center">
              <p className="text-caption text-text-subtle mb-2">새로운 합주방이 필요하다면</p>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                합주방 만들기
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
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
                  <p className="text-caption text-text-muted truncate">{setlistConfirmSong.artist}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted text-center mb-4">셋리스트에 추가할까요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSetlistConfirmSongId(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-hover hover:bg-border-strong text-sm text-text-muted font-medium transition-colors"
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
      >
        {/* 영상은 여기 한 번만 마운트한다. 카드 안으로 옮기면 브라우저가 다시 로드한다. */}
        <YouTubePlayer
          ref={playerRef}
          videoId={playerState.currentSong?.youtube_video_id ?? null}
          onEnded={handleEnded}
          onPlay={() => playerActions.setIsPlaying(true)}
          onPause={() => playerActions.setIsPlaying(false)}
        />
      </MiniPlayer>

      {/* Navigation Bar */}
      <NavigationBar
        mode={navMode}
        onModeChange={handleModeChange}
      />
    </>
  );
}
