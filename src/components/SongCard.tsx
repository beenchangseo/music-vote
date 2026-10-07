"use client";

import { useState, useTransition, useRef, useEffect, type ReactNode } from "react";
import Image from "next/image";
import VoteButtons from "./VoteButtons";
import CommentModal from "./CommentModal";
import SongVersionModal from "./SongVersionModal";
import { useDialog } from "./DialogProvider";
import { removeSong } from "@/actions/song";
import type { VoteDirection } from "@/lib/vote-domain";
import { displayArtist, displayTitle } from "@/lib/song-meta";
import type { SongWithScore, VotingMode } from "@/lib/types";

interface SongCardProps {
  song: SongWithScore;
  votingMode: VotingMode;
  nickname: string;
  shareCode: string;
  playlistId: string;
  isAdmin: boolean;
  adminToken: string | null;
  viewMode: "card" | "compact";
  /** 점수 순위 (1부터, 동점은 같은 번호). 목록 보기에서 행 맨 앞 칸에 그린다. */
  rank?: number;
  /** 목록 보기에서 이 곡의 행이 펼쳐져 있다 (디자인 C9). 한 번에 한 곡만 펼친다. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** 이 곡이 셋리스트에 들어 있다. */
  inSetlist?: boolean;
  onVotePress: (songId: string, direction: VoteDirection) => void;
  /** 이 곡의 투표 요청이 서버 응답을 기다리는 중. */
  votePending?: boolean;
  isPlaying: boolean;
  isCurrent: boolean;
  onTogglePlay: () => void;
  isExpired?: boolean;
  isHighlighted?: boolean;
  onAddToSetlist?: (songId: string) => void;
  onRemoveFromSetlist?: (songId: string) => void;
  /** false = 기명 모드. voter 닉네임을 모든 사용자에게 노출 */
  votesAnonymous?: boolean;
  /** 로그인 모드 + 비로그인 → 투표/댓글 시도 시 카카오 OAuth 트리거. */
  loginGate?: boolean;
  currentUserId?: string | null;
}

export default function SongCard({
  song,
  votingMode,
  nickname,
  shareCode,
  playlistId,
  isAdmin,
  adminToken,
  viewMode,
  rank,
  expanded = false,
  onToggleExpand,
  inSetlist = false,
  onVotePress,
  votePending = false,
  isPlaying,
  isCurrent,
  onTogglePlay,
  isExpired = false,
  isHighlighted = false,
  onAddToSetlist,
  onRemoveFromSetlist,
  votesAnonymous = true,
  loginGate = false,
  currentUserId,
}: SongCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versionCount, setVersionCount] = useState(song.versionCount);
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
    const ok = await showDanger(`"${song.title}"을(를) 삭제하시겠습니까?`);
    if (!ok) return;

    startTransition(async () => {
      try {
        await removeSong(song.id, playlistId, shareCode);
      } catch {
        showAlert("곡 삭제에 실패했습니다.");
      }
    });
  }

  const canRemove = isAdmin || (!!currentUserId && currentUserId === song.added_by_user_id);
  // YouTube 채널명이 아티스트가 아닌 경우가 많다. 표시할 때만 정제한다.
  const artist = displayArtist(song.artist, song.title);
  // 유튜브 원제목에서 아티스트 앞부분과 [가사/Lyrics] 같은 태그를 뗀 제목. 원제목은 펼친 행에 남긴다.
  const title = displayTitle(song.title);

  // VoteButtons 는 값을 그리기만 하므로 화면 폭에 따라 두 자리 중 하나에 놓아도 안전하다.
  const voteButtons = (
    <VoteButtons
      score={song.score}
      userVote={song.userVote}
      userVoteCount={song.userVoteCount}
      votingMode={votingMode}
      onPress={(direction) => onVotePress(song.id, direction)}
      disabled={isExpired || (!nickname && !loginGate)}
      pending={votePending}
      loginGate={loginGate}
    />
  );

  // Compact view (디자인 C9): one row of rank, cover, title and the vote pill. Tapping the title opens
  // the row in place with comments, versions, setlist and the menu, so the list stays one line per song.
  if (viewMode === "compact") {
    const topRank = rank != null && rank <= 3 && song.score > 0;
    const actionsId = `song-actions-${song.id}`;
    const hasMenu = canRemove || !!song.added_by;
    return (
      <div
        className={`-mx-2 rounded-card px-2 transition-colors ${
          expanded ? "bg-surface" : "hover:bg-surface/60"
        } ${isHighlighted ? "ring-1 ring-inset ring-warning/40" : ""} ${isPending ? "opacity-50" : ""}`}
      >
        <div className="flex min-h-[72px] items-center gap-2.5">
          {rank != null && (
            <span
              className={`w-5 shrink-0 text-center text-sm font-extrabold tabular-nums ${topRank ? "text-primary" : "text-text-subtle"}`}
            >
              {rank}
            </span>
          )}

          {/* Cover = play button (Spotify: tap the art to play). */}
          <button
            onClick={onTogglePlay}
            className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-control bg-surface-elevated"
            aria-label={`${title} ${isPlaying ? "일시정지" : "재생"}`}
          >
            {song.thumbnail_url && (
              <Image src={song.thumbnail_url} alt="" fill sizes="48px" className="object-cover" />
            )}
            <span
              className={`absolute inset-0 flex items-center justify-center transition-colors ${
                isCurrent ? "bg-black/45" : "bg-black/0 group-hover:bg-black/45"
              }`}
            >
              {isPlaying ? (
                <span className="flex items-end gap-0.5" aria-hidden>
                  <span className="h-2.5 w-0.5 animate-bounce rounded-full bg-accent-play" style={{ animationDelay: "0ms" }} />
                  <span className="h-4 w-0.5 animate-bounce rounded-full bg-accent-play" style={{ animationDelay: "150ms" }} />
                  <span className="h-3 w-0.5 animate-bounce rounded-full bg-accent-play" style={{ animationDelay: "300ms" }} />
                </span>
              ) : (
                <svg
                  className={`ml-0.5 h-5 w-5 text-white ${isCurrent ? "" : "opacity-0 transition-opacity group-hover:opacity-100"}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-controls={actionsId}
            className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left"
          >
            <span className={`line-clamp-2 text-body font-semibold leading-snug ${isCurrent ? "text-accent-play" : "text-text"}`}>
              {title}
            </span>
            {/* The second line is ~140px wide: the artist gets the room, comments and setlist are small marks. */}
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-text-muted">
              {artist && <span className="truncate">{artist}</span>}
              {song.commentCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />
                  </svg>
                  <span className="sr-only">댓글</span>
                  {song.commentCount}
                </span>
              )}
              {inSetlist && (
                <span className="inline-flex shrink-0 items-center text-primary">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M4 12h12M4 18h6M14 18l2.5 2.5L21 16" />
                  </svg>
                  <span className="sr-only">셋리스트에 있음</span>
                </span>
              )}
              <svg
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          <div className="shrink-0">{voteButtons}</div>
        </div>

        {expanded && (
          <div id={actionsId} className="pb-2">
            {title !== song.title.trim() && (
              <p className="mb-1 line-clamp-2 break-all text-caption text-text-subtle">원래 제목 · {song.title}</p>
            )}
            <VoterStrip votes={song.votes} hide={votesAnonymous} />
            {/* Right-aligned next to ⋯, under the vote pill, so the row reads as one block. */}
            <div className="-mr-1 flex items-center justify-end gap-1.5">
              <ActionPill onClick={() => setShowComments(true)}>
                <svg className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />
                </svg>
                {song.commentCount > 0 ? `댓글 ${song.commentCount}` : "댓글"}
              </ActionPill>
              <ActionPill onClick={() => setShowVersions(true)}>
                {versionCount > 0 ? `다른 버전 ${versionCount}` : "다른 버전"}
              </ActionPill>
              {/* 셋리스트는 ⋯ 안에 숨기면 못 찾는다. 펼친 줄에 바로 둔다. 들어 있으면 눌러서 뺀다. */}
              {inSetlist && onRemoveFromSetlist ? (
                <ActionPill selected onClick={() => onRemoveFromSetlist(song.id)} label="셋리스트에서 빼기">
                  <CheckIcon />
                  셋리스트
                </ActionPill>
              ) : !inSetlist && onAddToSetlist ? (
                <ActionPill onClick={() => onAddToSetlist(song.id)} label="셋리스트에 넣기">
                  <PlusIcon />
                  셋리스트
                </ActionPill>
              ) : null}

              {hasMenu && (
                <div className="relative shrink-0" ref={showMenu ? menuRef : undefined}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="flex h-11 w-11 items-center justify-center rounded-pill text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
                    aria-label="더보기"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                    </svg>
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-lg">
                      {song.added_by && (
                        <div className="truncate px-3 py-2 text-caption text-text-subtle">
                          추가: <span className="text-text-muted">{song.added_by}</span>
                        </div>
                      )}
                      {canRemove && (
                        <button
                          onClick={() => { handleRemove(); setShowMenu(false); }}
                          disabled={isPending}
                          className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-danger transition-colors hover:bg-surface-hover ${song.added_by ? "border-t border-border" : ""}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          곡 삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {showComments && (
          <CommentModal
            songId={song.id}
            songTitle={title}
            nickname={nickname}
            shareCode={shareCode}
            onClose={() => setShowComments(false)}
            loginGate={loginGate}
          />
        )}
        {showVersions && (
          <SongVersionModal songId={song.id} songTitle={title} nickname={nickname} shareCode={shareCode} currentUserId={currentUserId} isAdmin={isAdmin} adminToken={adminToken} loginGate={loginGate} onCountChange={setVersionCount} onClose={() => setShowVersions(false)} />
        )}
      </div>
    );
  }

  // Card (video) view
  return (
    <div className={`bg-surface rounded-2xl border overflow-hidden transition-all hover:border-border-strong ${isCurrent ? "border-primary/50" : "border-border"} ${isPending ? "opacity-50" : ""}`}>
      {/* 영상은 아래 플레이어에서 재생한다. 카드는 썸네일과 재생 상태만 보여준다. */}
      <button
        onClick={onTogglePlay}
        className="relative w-full aspect-video bg-surface-hover group"
        aria-label={`${song.title} ${isPlaying ? "일시정지" : "재생"}`}
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
          <div className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg transition-colors ${isCurrent ? "bg-primary group-hover:bg-primary-hover" : "bg-red-600 group-hover:bg-red-500"}`}>
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
        {isCurrent && (
          <span className="absolute left-2 top-2 rounded-md bg-primary/90 px-2 py-0.5 text-caption font-semibold text-white">
            재생 중
          </span>
        )}
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold leading-snug line-clamp-2 ${isCurrent ? "text-primary" : "text-text"}`}>{title}</h3>
            {artist && (
              <p className="text-sm text-text-muted truncate mt-0.5">{artist}</p>
            )}
          </div>
          <div className="shrink-0">{voteButtons}</div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setShowComments(true)}
            className={`text-caption transition-colors flex items-center gap-1 ${
              song.commentCount > 0
                ? "text-primary hover:text-primary-hover font-semibold"
                : "text-text-subtle hover:text-primary"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            댓글
            {song.commentCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary/20 text-[10px] font-bold tabular-nums">
                {song.commentCount}
              </span>
            )}
          </button>
          <button onClick={() => setShowVersions(true)} className={`flex min-h-11 items-center gap-1 text-caption transition-colors ${versionCount > 0 ? "font-semibold text-warning" : "text-text-subtle hover:text-warning"}`}>
            <VersionIcon /> 다른 버전
            {versionCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-soft px-1 text-[10px] font-bold">{versionCount}</span>}
          </button>
          {onAddToSetlist && (
            <button
              onClick={() => onAddToSetlist(song.id)}
              className="flex min-h-11 items-center gap-1 text-caption text-text-subtle transition-colors hover:text-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              셋리스트에 추가
            </button>
          )}
          {canRemove && (
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="text-caption text-text-subtle hover:text-red-400 transition-colors"
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
          loginGate={loginGate}
        />
      )}
      {showVersions && (
        <SongVersionModal songId={song.id} songTitle={song.title} nickname={nickname} shareCode={shareCode} currentUserId={currentUserId} isAdmin={isAdmin} adminToken={adminToken} loginGate={loginGate} onCountChange={setVersionCount} onClose={() => setShowVersions(false)} />
      )}
    </div>
  );
}

/** 펼친 행의 버튼 (디자인 C9). 보이는 높이는 36px, 누르는 자리는 44px. */
function ActionPill({
  onClick,
  selected = false,
  label,
  children,
}: {
  onClick: () => void;
  selected?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="group/pill inline-flex min-h-11 shrink-0 items-center">
      <span
        className={`inline-flex h-9 items-center gap-1.5 rounded-pill px-3.5 text-sm font-semibold transition-colors ${
          selected ? "bg-primary-soft text-text" : "bg-surface-hover text-text group-hover/pill:bg-border"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2.75} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2.75} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function VersionIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9m-9 16.5h9M5.25 7.5l-2.25 2.25L5.25 12m13.5 0L21 14.25l-2.25 2.25M3 9.75h13.5M7.5 14.25H21" />
    </svg>
  );
}

// 기명 투표 모드일 때 voter 닉네임을 한 줄로 노출.
function VoterStrip({
  votes,
  hide,
}: {
  votes: { vote_type: number; nickname: string }[];
  hide: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (hide || votes.length === 0) return null;

  const summarize = (voteType: 1 | -1) => {
    const counts = new Map<string, { nickname: string; count: number }>();
    for (const vote of votes) {
      if (vote.vote_type !== voteType) continue;
      const key = vote.nickname.toLowerCase();
      const current = counts.get(key);
      counts.set(key, {
        nickname: current?.nickname ?? vote.nickname,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...counts.values()].map(({ nickname, count }) => (
      count > 1 ? `${nickname} ×${count}` : nickname
    ));
  };
  const up = summarize(1);
  const down = summarize(-1);

  if (up.length === 0 && down.length === 0) return null;

  // 34곡 목록에서 모든 행에 이름을 깔면 소음이 크다. 기본은 수만 보이고 눌러서 편다.
  // 같은 줄의 투표 버튼이 이미 44px 이라 이 버튼을 키워도 행 높이는 그대로다.
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      aria-label={expanded ? "투표한 사람 접기" : "투표한 사람 보기"}
      className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left text-caption text-text-muted"
    >
      {up.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <svg className="h-3 w-3 text-success" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 4l8 8h-5v8h-6v-8H4z" />
          </svg>
          {up.length}
        </span>
      )}
      {down.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <svg className="h-3 w-3 text-danger" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 20l-8-8h5V4h6v8h5z" />
          </svg>
          {down.length}
        </span>
      )}

      {expanded ? (
        <span className="min-w-0 flex-1 text-text-subtle">
          {up.length > 0 && <span className="break-keep">{up.join(" · ")}</span>}
          {up.length > 0 && down.length > 0 && <span className="mx-1">/</span>}
          {down.length > 0 && <span className="break-keep">{down.join(" · ")}</span>}
        </span>
      ) : (
        <span className="truncate text-text-subtle">누가 찍었는지 보기</span>
      )}
    </button>
  );
}
