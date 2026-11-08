"use client";

import { useState, useCallback, useEffect, useMemo, useRef, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Image from "next/image";
import Link from "next/link";
import { useDialog } from "../ui/DialogProvider";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import InlineNotice from "../ui/InlineNotice";
import { SongRow } from "../ui/ListRow";
import Modal from "../ui/Modal";
import RoundButton from "../ui/RoundButton";
import LoginButton from "../auth/LoginButton";
import PlaylistHeader from "./PlaylistHeader";
import PlaylistTitleBar from "./PlaylistTitleBar";
import AddSongForm from "./AddSongForm";
import SongCard from "./SongCard";
import VoteButtons from "./VoteButtons";
import MiniPlayer from "./MiniPlayer";
import YouTubePlayer from "./YouTubePlayer";
import NavigationBar from "./NavigationBar";
import SetlistView from "../setlist/SetlistView";
import RehearsalView from "../rehearsal/RehearsalView";
import { usePlayerQueue } from "@/hooks/usePlayerQueue";
import { usePlaylistVotes } from "@/hooks/usePlaylistVotes";
import { usePlaylistRealtime } from "@/hooks/usePlaylistRealtime";
import { confirmSetlist, insertSetlistBlock, removeSetlistItem } from "@/actions/setlist";
import { setlistMessage } from "@/lib/setlist-messages";
import { fetchComments, fetchSetlistItems } from "@/lib/playlist-refetch";
import { track } from "@/lib/analytics";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
import KakaoShareButton from "../share/KakaoShareButton";
import RoomSettingsButton, { type RoomSettingsHandle } from "./RoomSettingsButton";
import BandPromptCard, { BandCreatedCard } from "../band/BandPromptCard";
import BandInviteSheet from "../band/BandInviteSheet";
import type { CreatedBand } from "../band/CreateBandSheet";
import VoteAllowanceStatus from "./VoteAllowanceStatus";
import { registerPlaylistMember } from "@/actions/member";
import type { ViewMode } from "./NavigationBar";
import { setlistEditAccess } from "@/domain/setlist";
import { setlistStatus } from "@/domain/setlist-card";
import { PLAYLIST_TAB_PARAM, type PlaylistLinkTab } from "@/domain/playlist-tab";
import type { MyTeam } from "@/actions/team";
import type { PlaylistView, RoomTeam, SongWithScore, SetlistItem, Comment, VoteAllowance } from "@/domain/types";
import { displayTitle } from "@/domain/song-meta";
import { inviteSongs } from "@/domain/invite-card";
import { assignRanks } from "@/domain/vote";
import { PLAYLIST_STAGE_LABEL } from "@/domain/playlist-stage";
import { isPastDeadline } from "@/domain/deadline";

interface PlaylistClientProps {
  playlist: PlaylistView;
  songs: SongWithScore[];
  shareCode: string;
  participantCount: number;
  userNickname?: string;
  loggedIn: boolean;
  /** The page's hostDenial answer for this viewer. Account ids never reach the browser (docs/adr/0011). */
  isHost: boolean;
  currentUserAvatarUrl?: string | null;
  /** The room's band, trimmed per viewer by the page (R10 payload table). null for rooms without a band. */
  team?: RoomTeam | null;
  /** Owner of a room without a band only: bands this room can join (T14). */
  myTeams?: MyTeam[];
  /** Owner of a room without a band only: logged-in room members, for the band prompt (F7). */
  memberCount?: number | null;
  /** The band prompt was closed for this room (server read of the dismissal cookie, DR6). */
  bandPromptDismissed?: boolean;
  /** Setlist read with the page, so candidate rows can show "셋리스트에 있음" (디자인 C9). */
  initialSetlistItems?: SetlistItem[] | null;
  /** The tab the link asked for, already checked by the page (initialPlaylistTab). */
  initialTab?: PlaylistLinkTab;
}

export default function PlaylistClient({
  playlist,
  songs,
  shareCode,
  participantCount,
  userNickname,
  loggedIn,
  isHost,
  currentUserAvatarUrl,
  team = null,
  myTeams = [],
  memberCount = null,
  bandPromptDismissed = false,
  initialSetlistItems = null,
  initialTab = "playlist",
}: PlaylistClientProps) {
  // 보관된 합주방: 로그인 도입 전 익명 합주방. 지난 기록만 읽는다.
  const isArchived = playlist.archived;
  const loginGate = !isArchived && !loggedIn;
  // 닉네임은 카카오 프로필에서 그대로 쓴다.
  const nickname = !isArchived && loggedIn ? userNickname || "" : "";
  const [viewMode, setViewMode] = useState<"card" | "compact">("compact");
  const [navMode, setNavMode] = useState<ViewMode>(initialTab);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<VoteAllowance | null>(null);
  // Band made from the prompt card (R6). Lives here, not in the card: the action's revalidatePath
  // re-renders the room with a band, the prompt condition turns false and the card unmounts.
  const [justCreatedTeam, setJustCreatedTeam] = useState<CreatedBand | null>(null);
  const [createdInviteOpen, setCreatedInviteOpen] = useState(false);

  // Setlist comes with the page (candidate rows mark songs already in it); comments load on the rehearsal tab.
  const [setlistItems, setSetlistItems] = useState<SetlistItem[] | null>(initialSetlistItems);
  // 디자인 C9: one candidate row open at a time.
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingSetlist, setLoadingSetlist] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const { showConfirm, showAlert, showDanger } = useDialog();
  const router = useRouter();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [listParent] = useAutoAnimate({ duration: 300, easing: "ease-in-out" });

  useEffect(() => {
    try {
      const myPlaylists = JSON.parse(localStorage.getItem("myPlaylists") || "[]");
      const found = myPlaylists.find(
        (p: { id?: string; shareCode?: string }) => p.id === playlist.id || p.shareCode === shareCode
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- unchanged mount-time read; moving it to useSyncExternalStore (as MyPlaylists.tsx does) is its own change.
      setAdminToken(found?.adminToken || null);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 링크 토큰은 플레이리스트를 만든 기기에만 남아 로그인 플레이리스트의 방장 판정에 쓰지 않는다(#47).
  const isAdmin = isArchived ? !!adminToken : isHost;
  const isExpired = isPastDeadline(playlist.deadline, new Date());
  const setlistAccess = setlistEditAccess({ archived: isArchived, mode: playlist.setlist_edit_mode, loggedIn, isHost: isAdmin });
  const canEditSetlist = setlistAccess === "edit";
  // F7: owner · room without a band · at least two logged-in members. A brand-new room (1 member) has no card.
  const showBandPrompt =
    isAdmin && !isArchived && loggedIn && !playlist.team_id && !team && (memberCount ?? 0) >= 2;

  useEffect(() => {
    if (isArchived || !loggedIn) return;
    registerPlaylistMember(playlist.id).then(setAllowance).catch(() => {
      showAlert("참여자 등록에 실패했습니다. 새로고침 후 다시 시도해주세요.");
    });
  }, [isArchived, loggedIn, playlist.id, showAlert]);

  // Lazy load setlist items on first mode switch
  const handleModeChange = useCallback(async (mode: ViewMode) => {
    window.scrollTo({ top: 0 });
    setNavMode(mode);
    // The link's ?tab= only picks the first tab. Left in the address, a refresh in KakaoTalk's browser or a copied address
    // would jump back to it after the member moved on.
    const url = new URL(window.location.href);
    if (url.searchParams.has(PLAYLIST_TAB_PARAM)) {
      url.searchParams.delete(PLAYLIST_TAB_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    track("playlist_tab_viewed", { tab: mode === "playlist" ? "candidates" : mode });
    if (mode === "setlist" && setlistItems === null && !loadingSetlist) {
      setLoadingSetlist(true);
      try {
        const items = await fetchSetlistItems(playlist.id);
        setSetlistItems(items);
      } catch { /* ignore */ }
      setLoadingSetlist(false);
    }
    if (mode === "rehearsal" && comments === null && !loadingComments) {
      setLoadingComments(true);
      try {
        const [items, cmts] = await Promise.all([
          setlistItems === null ? fetchSetlistItems(playlist.id) : Promise.resolve(setlistItems),
          fetchComments(playlist.id),
        ]);
        if (setlistItems === null) setSetlistItems(items);
        setComments(cmts);
      } catch { /* ignore */ }
      setLoadingComments(false);
    }
  }, [playlist.id, setlistItems, comments, loadingSetlist, loadingComments]);

  // Each read takes the next number and draws only if nothing newer has: a read that lands after a later read, or one
  // in flight when a write of mine lands, may carry an older list. A write marks every read started so far as drawn,
  // and the read that applySetlistItems starts after it covers anything they carried.
  const setlistReadsRef = useRef({ started: 0, drawn: 0 });
  const refetchSetlist = useCallback(async () => {
    const reads = setlistReadsRef.current;
    const read = ++reads.started;
    const items = await fetchSetlistItems(playlist.id);
    if (read <= reads.drawn) return;
    reads.drawn = read;
    setSetlistItems(items);
  }, [playlist.id]);

  // 다른 참여자의 변경 알림. 셋리스트·댓글은 서버 렌더가 아니라
  // 클라이언트가 따로 받아둔 값이라 이미 열어본 목록만 다시 받아온다.
  // A failed read rejects, so usePlaylistRealtime tries again instead of waiting for the next change.
  const handleRemoteChange = useCallback(async () => {
    router.refresh();
    await Promise.all([
      setlistItems !== null && refetchSetlist(),
      comments !== null && fetchComments(playlist.id).then(setComments),
    ]);
  }, [router, playlist.id, setlistItems, comments, refetchSetlist]);

  const { notifyChange, requestRefresh } = usePlaylistRealtime(shareCode, handleRemoteChange);

  /**
   * 서버에 닿은 셋리스트를 그리고 다른 화면에 알린다. 쓰기는 닿았지만 목록을 못 읽었으면 지금 목록을 고치는 함수를 받는다.
   * 누를 때의 목록으로 그리면 쓰기를 기다리는 동안 그린 다른 멤버의 변경을 덮는다.
   */
  const applySetlistItems = useCallback((items: SetStateAction<SetlistItem[]>) => {
    setlistReadsRef.current.drawn = setlistReadsRef.current.started;
    setSetlistItems((current) => (typeof items === "function" ? current && items(current) : items));
    notifyChange();
    // The write's answer can be older than a read that already landed with another member's later change.
    refetchSetlist().catch(requestRefresh);
  }, [notifyChange, refetchSetlist, requestRefresh]);

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



  // A failed server read leaves the items unknown until the setlist tab loads them. Until then the banner and the Kakao
  // card print no count, since setlist_count is only the target and the candidates are not the setlist (#87). Counted
  // like the setlist tab and the exports: a block whose candidate the host just deleted stays in this screen's loaded
  // setlist until the next read, but it is no longer a song of the setlist.
  const setlist = setlistItems === null ? null : setlistStatus(playlist.setlist_confirmed, setlistItems, songsWithVotes);
  // The cron also sets the confirm flag on an expired playlist with no songs, so the flag alone does not mean a setlist.
  // While the items are unknown the flag decides.
  const showsConfirmedSetlist = setlist === null ? playlist.setlist_confirmed : setlist.stage === "confirmed";

  // Setlist highlight: top N songs after deadline
  const setlistCount = playlist.setlist_count;
  const highlightedSongIds = useMemo(() => {
    if (!isExpired || !setlistCount || setlistCount <= 0) return new Set<string>();
    return new Set(songsWithVotes.slice(0, setlistCount).map((s) => s.id));
  }, [isExpired, setlistCount, songsWithVotes]);

  // Player queue
  const { state: playerState, actions: playerActions } = usePlayerQueue(songsWithVotes, setlistItems);

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
      playerActions.playSong(songId, "candidates");
    }
  }, [playerState.currentSongId, playerState.isPlaying, playerActions]);

  const handlePlayFromSetlist = useCallback((songId: string) => {
    playerActions.playSong(songId, "setlist");
    // Same video, so nothing reloads: a paused player has to be told to go on.
    if (playerState.currentSongId === songId) playerRef.current?.play();
  }, [playerState.currentSongId, playerActions]);

  // Header "전체 듣기": resume or pause what is loaded, otherwise start from the top of the list.
  const handlePlayAll = useCallback(() => {
    if (playerState.currentSongId) {
      handleTogglePlay(playerState.currentSongId);
      return;
    }
    const first = songsWithVotes[0];
    if (!first) return;
    playerActions.playSong(first.id, "candidates");
    try {
      track("play_all_started", { song_count: songsWithVotes.length, source: "candidates" });
    } catch {
      // Analytics never blocks playback.
    }
  }, [playerState.currentSongId, handleTogglePlay, songsWithVotes, playerActions]);

  // Score rank for every row (디자인 C9).
  // Ties share a number (5,5,4 → 1,1,3): with a number on every row, 1,2,3 for equal scores would read as a ranking.
  const rankById = useMemo(() => {
    const ranks = assignRanks(songsWithVotes.map((song) => song.score));
    return new Map(songsWithVotes.map((song, index) => [song.id, ranks[index]]));
  }, [songsWithVotes]);

  const setlistSongIds = useMemo(
    () => new Set((setlistItems ?? []).flatMap((item) => (item.item_type === "song" && item.song_id ? [item.song_id] : []))),
    [setlistItems],
  );

  // The header's ⋮ sheet opens the settings modal; the gear no longer sits in each tab's toolbar.
  const settingsRef = useRef<RoomSettingsHandle>(null);

  // Cover mosaic: the best-scored songs first, each picture once.
  const coverThumbs = useMemo(() => {
    const thumbs: string[] = [];
    for (const song of songsWithVotes) {
      if (song.thumbnail_url && !thumbs.includes(song.thumbnail_url)) thumbs.push(song.thumbnail_url);
      if (thumbs.length === 4) break;
    }
    return thumbs;
  }, [songsWithVotes]);

  const invite = useMemo(() => inviteSongs(songs), [songs]);

  // Setlist add confirm dialog
  const [setlistConfirmSongId, setSetlistConfirmSongId] = useState<string | null>(null);
  const [addingToSetlist, setAddingToSetlist] = useState(false);
  const setlistConfirmSong = setlistConfirmSongId ? songsWithVotes.find((s) => s.id === setlistConfirmSongId) : null;

  const handleAddToSetlist = useCallback((songId: string) => {
    setSetlistConfirmSongId(songId);
  }, []);

  async function handleRemoveFromSetlist(songId: string) {
    const item = setlistItems?.find((entry) => entry.item_type === "song" && entry.song_id === songId);
    if (!item) return;
    const song = songsWithVotes.find((s) => s.id === songId);
    const ok = await showDanger(song ? `「${displayTitle(song.title)}」을 셋리스트에서 뺄까요?` : "셋리스트에서 뺄까요?");
    if (!ok) return;
    const previous = setlistItems;
    setSetlistItems((prev) => prev?.filter((entry) => entry.id !== item.id) ?? prev);
    const result = await removeSetlistItem(playlist.id, item.id, shareCode).catch(() => null);
    if (result?.success) {
      applySetlistItems(result.items ?? ((entries) => entries.filter((entry) => entry.id !== item.id)));
      return;
    }
    setSetlistItems(previous);
    showAlert(result && result.reason !== "write_failed" ? setlistMessage(result.reason) : "셋리스트에서 빼지 못했어요.");
  }

  async function handleConfirmAddToSetlist() {
    if (!setlistConfirmSongId || addingToSetlist) return;
    setAddingToSetlist(true);
    const result = await insertSetlistBlock(playlist.id, { before: null }, { kind: "song", songId: setlistConfirmSongId }, shareCode).catch(() => null);
    setAddingToSetlist(false);
    if (!result?.success) {
      showAlert(setlistMessage(result?.reason ?? "write_failed"));
      return;
    }
    applySetlistItems(result.items);
    setSetlistConfirmSongId(null);
  }

  // 한 줄 메타. 있는 것만 가운뎃점으로 잇는다. 곡 수가 맨 앞이다 (후보곡 툴바가 없어졌다).
  const metaParts: { key: string; text: string; className: string }[] = [
    { key: "songs", text: `${songs.length}곡`, className: "font-semibold text-text" },
  ];
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
      className: isExpired ? "text-danger-fg" : "",
    });
  }
  if (nickname) {
    metaParts.push({ key: "me", text: `${nickname}으로 참여 중`, className: "text-text-subtle" });
  }

  // Bottom padding: NavigationBar(52px) + MiniPlayer(~56px if active)
  const bottomPadding = playerState.currentSongId ? "pb-40" : "pb-20";
  const memberBand = team?.isMember && team.id && team.name ? { id: team.id, name: team.name, nextShowAt: team.nextShowAt } : null;

  /*
    방 설정은 화면 설정이 아니라 방 설정이다. 투표 공개 범위도, 셋리스트 편집 권한도
    playlists 행에 붙어 있다. 그래서 진입점을 하나로 두고 세 화면 툴바의 같은 자리에 건다.
    종전에는 후보곡·합주에 떠 있는 톱니, 셋리스트에 전체 폭 토글 박스로 흩어져 있었다.
  */
  const canOpenSettings = isAdmin && !isArchived;
  const settingsButton = canOpenSettings ? (
    <RoomSettingsButton
      ref={settingsRef}
      hideTrigger
      playlistId={playlist.id}
      shareCode={shareCode}
      adminToken={adminToken}
      supportsVoteAllocation
      team={team}
      myTeams={myTeams}
      setlistEditMode={playlist.setlist_edit_mode}
      onSetlistEditModeChange={notifyChange}
      onAllowanceChange={(mode, usedVotes, voteLimit) => setAllowance({ mode, usedVotes, voteLimit })}
      onVotesAnonymousChange={notifyChange}
      onVotesReset={() => {
        resetVotes();
        notifyChange();
      }}
    />
  ) : null;

  return (
    <>
      <div className="min-h-full bg-bg">
        {/* The one-line title bar of the setlist and rehearsal tabs starts nearer the top than the 후보곡 header. */}
        <div className={`max-w-lg mx-auto px-4 ${navMode !== "playlist" ? "pt-3" : "pt-6"} ${bottomPadding}`}>
          {navMode !== "playlist" ? (
            <PlaylistTitleBar
              title={playlist.title}
              band={memberBand}
              currentUserNickname={userNickname}
              currentUserAvatarUrl={currentUserAvatarUrl}
              loginGate={loginGate}
            />
          ) : (
            <PlaylistHeader
              playlistId={playlist.id}
              title={playlist.title}
              inviteSongs={invite}
              archived={isArchived}
              shareCode={shareCode}
              participantCount={participantCount}
              announcement={playlist.announcement}
              currentUserNickname={userNickname}
              currentUserAvatarUrl={currentUserAvatarUrl}
              band={memberBand}
              showDate={team?.nextShowAt ?? null}
              coverThumbs={coverThumbs}
              onPlayAll={songsWithVotes.length > 0 ? handlePlayAll : undefined}
              playing={playerState.isPlaying}
              onOpenSettings={canOpenSettings ? () => settingsRef.current?.open() : undefined}
              viewToggle={
                songsWithVotes.length > 0 ? (
                  <RoundButton
                    tone="tonal"
                    size="lg"
                    onClick={() => setViewMode(viewMode === "compact" ? "card" : "compact")}
                    aria-label={viewMode === "compact" ? "카드 보기" : "리스트 보기"}
                  >
                    {viewMode === "compact" ? (
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                        <rect x="3.5" y="4.5" width="17" height="10" rx="2" />
                        <path strokeLinecap="round" d="M3.5 19h17" />
                      </svg>
                    ) : (
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                    )}
                  </RoundButton>
                ) : undefined
              }
              meta={
                /*
                  참여자 수·마감·내 닉네임·로그인이 세 덩어리로 흩어져 있었다.
                  정렬축이 계속 바뀌어 위계가 읽히지 않았으므로 제목 아래 한 줄로 합친다.
                */
                <div className="flex flex-wrap items-center justify-center gap-x-2">
                  <p className="min-w-0 text-caption leading-relaxed text-text-muted tabular-nums">
                    {metaParts.map((part, i) => (
                      <span key={part.key}>
                        {i > 0 && <span className="mx-1.5 text-text-subtle" aria-hidden>·</span>}
                        <span className={part.className}>{part.text}</span>
                      </span>
                    ))}
                  </p>
                  {loginGate && (
                    <LoginButton variant="tonal" size="sm" label="로그인" className="shrink-0" />
                  )}
                </div>
              }
            />
          )}

          {isArchived && (
            <InlineNotice
              role="status"
              className="mt-3 animate-fade-in"
              action={
                <Link href="/" className="font-semibold text-primary-fg underline-offset-2 hover:underline">
                  새 플레이리스트 만들기 →
                </Link>
              }
            >
              <span className="font-semibold text-text">보관된 플레이리스트예요.</span>{" "}
              지난 투표 결과와 셋리스트는 그대로 볼 수 있지만, 새로 투표하거나 곡을 추가할 수는 없어요.
            </InlineNotice>
          )}


          {/* YouTube Player is rendered inline inside SongCard */}

          {/* === MODE: PLAYLIST === */}
          {navMode === "playlist" && (
            <>
              {/* Allocated voting: how many votes are left, right above the songs. */}
              {allowance?.mode === "allocated" && (
                <div className="mt-5 text-center text-caption text-text-muted tabular-nums">
                  <VoteAllowanceStatus allowance={allowance} />
                </div>
              )}

              {/* 27A: candidates tab only, under the toolbar and above the songs. */}
              {justCreatedTeam ? (
                <BandCreatedCard
                  band={justCreatedTeam}
                  onShare={() => setCreatedInviteOpen(true)}
                  onDismiss={() => setJustCreatedTeam(null)}
                />
              ) : showBandPrompt ? (
                <BandPromptCard
                  playlistId={playlist.id}
                  dismissed={bandPromptDismissed}
                  onCreated={setJustCreatedTeam}
                />
              ) : null}

              {/* Add song form (hide if expired) */}
              {!isExpired && !isArchived && (
                <div className="mt-6">
                  <AddSongForm playlistId={playlist.id} shareCode={shareCode} loginGate={loginGate} onAdded={notifyChange} />
                </div>
              )}

              {/* Result share banner — voting closed + has top song */}
              {isExpired && songsWithVotes.length > 0 && (
                <div className="mt-5 p-5 rounded-card bg-success/10 border border-success/30 text-center animate-fade-in">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-success/20 text-success text-caption font-bold mb-3">
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
                    size="md"
                  >
                    카톡 단톡방에 결과 공유
                  </KakaoShareButton>
                </div>
              )}

              {/* Setlist confirmation banner */}
              {isExpired && setlistCount && !playlist.setlist_confirmed && (
                <div className="mt-5 p-4 bg-primary/10 border border-primary/30 rounded-control text-center">
                  <p className="text-sm text-text mb-2">
                    투표가 마감되었습니다. 상위 {setlistCount}곡이 하이라이트됩니다.
                  </p>
                  {isHost ? (
                    <Button
                      onClick={async () => {
                        const topSongIds = songsWithVotes.slice(0, setlistCount).map((s) => s.id);
                        const ok = await showConfirm(
                          setlistItems?.length ? "지금 셋리스트로 확정할까요?" : `상위 ${setlistCount}곡으로 셋리스트를 확정하시겠습니까?`,
                        );
                        if (!ok) return;
                        const result = await confirmSetlist(playlist.id, topSongIds, shareCode).catch(() => null);
                        if (!result?.success) {
                          showAlert(result && result.reason !== "write_failed" ? setlistMessage(result.reason) : "셋리스트 확정에 실패했습니다.");
                          return;
                        }
                        track("setlist_confirmed", {
                          song_count: result.items.filter((item) => item.item_type !== "interval").length,
                          auto: false,
                        });
                        applySetlistItems(result.items);
                      }}
                    >
                      셋리스트 확정하기
                    </Button>
                  ) : (
                    <p className="text-caption text-text-muted">셋리스트는 방장이 확정해요</p>
                  )}
                </div>
              )}

              {/* Setlist share banner — confirmed setlist */}
              {showsConfirmedSetlist && (
                <Card className="mt-5 text-center animate-fade-in">
                  <Badge tone="primary">🎵 {PLAYLIST_STAGE_LABEL.confirmed}</Badge>
                  <p className="mt-3 mb-4 text-sm text-text">
                    {setlist !== null && `총 ${setlist.songCount}곡 · `}다음 공연 준비 완료
                  </p>
                  <KakaoShareButton
                    shareCode={shareCode}
                    variant="setlist"
                    title={playlist.title}
                    songs={songs.length}
                    participants={participantCount}
                    setlist={setlist}
                    size="md"
                  >
                    셋리스트 카톡 공유
                  </KakaoShareButton>
                </Card>
              )}

              {/* Song list */}
              <div
                ref={listParent}
                className={`mt-3 ${viewMode === "compact" ? "space-y-1" : "space-y-4"}`}
              >
                {songsWithVotes.length === 0 ? (
                  <div className="mt-2">
                    <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-primary-fg animate-bounce-slow">
                      <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
                      </svg>
                      위 입력창부터
                    </p>
                    <EmptyState
                      title="첫 곡을 추가해보세요"
                      description={
                        <>
                          <p className="leading-relaxed">
                            YouTube 링크를 붙여넣으면<br />
                            제목·썸네일이 자동으로 들어가요.
                          </p>
                          <div className="mt-6 flex flex-col gap-1.5 text-caption text-text-subtle">
                            <p>곡 3개 이상 → 멤버에게 카톡으로 공유</p>
                            <p>5분 안에 다음 합주곡 결정 끝.</p>
                          </div>
                        </>
                      }
                    />
                  </div>
                ) : (
                  songsWithVotes.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      votingMode={playlist.voting_mode}
                      votesAnonymous={playlist.votes_anonymous}
                      nickname={nickname}
                      shareCode={shareCode}
                      playlistId={playlist.id}
                      viewMode={viewMode}
                      rank={rankById.get(song.id)}
                      expanded={expandedSongId === song.id}
                      onToggleExpand={() => setExpandedSongId((current) => (current === song.id ? null : song.id))}
                      inSetlist={setlistSongIds.has(song.id)}
                      onVotePress={pressVote}
                      votePending={isVotePending(song.id)}
                      isPlaying={playerState.currentSongId === song.id && playerState.isPlaying}
                      isCurrent={playerState.currentSongId === song.id}
                      onTogglePlay={() => handleTogglePlay(song.id)}
                      isExpired={isExpired}
                      isHighlighted={highlightedSongIds.has(song.id)}
                      onAddToSetlist={canEditSetlist ? handleAddToSetlist : undefined}
                      onRemoveFromSetlist={canEditSetlist ? handleRemoveFromSetlist : undefined}
                      loginGate={loginGate}
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
              loading={loadingSetlist}
              onItemsChange={applySetlistItems}
              title={playlist.title}
              access={setlistAccess}
              onPlay={handlePlayFromSetlist}
              player={playerState}
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
            />
          )}

          {/* CTA: Create your own — 페이지 가장 아래 (모든 모드 공통, 곡이 있을 때만) */}
          {songsWithVotes.length > 0 && (
            <div className="mt-10 mb-4 text-center">
              <p className="text-caption text-text-subtle mb-2">새로운 플레이리스트가 필요하다면</p>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-fg hover:text-on-primary-tint transition-colors"
              >
                플레이리스트 만들기
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>

      {settingsButton}

      {setlistConfirmSong && (
        <Modal open onClose={() => setSetlistConfirmSongId(null)} title="셋리스트에 추가할까요?">
          <SongRow
            cover={
              setlistConfirmSong.thumbnail_url && (
                <Image src={setlistConfirmSong.thumbnail_url} alt={displayTitle(setlistConfirmSong.title)} fill sizes="48px" className="object-cover" />
              )
            }
          >
            <p className="truncate text-sm font-medium text-text">{displayTitle(setlistConfirmSong.title)}</p>
            {setlistConfirmSong.artist && <p className="truncate text-caption text-text-muted">{setlistConfirmSong.artist}</p>}
          </SongRow>
          <Button size="lg" fullWidth className="mt-4" loading={addingToSetlist} onClick={handleConfirmAddToSetlist}>
            추가하기
          </Button>
        </Modal>
      )}

      {justCreatedTeam && (
        <BandInviteSheet
          open={createdInviteOpen}
          onClose={() => setCreatedInviteOpen(false)}
          teamId={justCreatedTeam.teamId}
          name={justCreatedTeam.name}
          inviteCode={justCreatedTeam.inviteCode}
          memberCount={justCreatedTeam.memberCount}
          nextShowAt={null}
          ownerName={nickname || null}
          isOwner
          onInviteCodeChange={(inviteCode) => setJustCreatedTeam((current) => (current ? { ...current, inviteCode } : current))}
        />
      )}

      {/* Mini Player (positioned above NavigationBar via CSS bottom-[52px]) */}
      <MiniPlayer
        state={playerState}
        actions={playerActions}
        playerRef={playerRef}
        songActions={
          // YouTube Music's like/dislike pill = our vote pill, for the song on air.
          playerState.currentSong ? (
            <VoteButtons
              score={playerState.currentSong.score}
              userVote={playerState.currentSong.userVote}
              userVoteCount={playerState.currentSong.userVoteCount}
              votingMode={playlist.voting_mode}
              onPress={(direction) => pressVote(playerState.currentSong!.id, direction)}
              disabled={isExpired || isArchived || (!nickname && !loginGate)}
              pending={isVotePending(playerState.currentSong.id)}
              loginGate={loginGate}
            />
          ) : undefined
        }
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
