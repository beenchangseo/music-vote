"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import VoteButtons from "./VoteButtons";
import CommentModal from "./CommentModal";
import SongVersionModal from "./SongVersionModal";
import { useDialog } from "./DialogProvider";
import { removeSong } from "@/actions/song";
import type { VoteDirection } from "@/lib/vote-domain";
import { displayArtist } from "@/lib/song-meta";
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
  /** 1~3위만 번호를 보여준다. 34곡에 전부 달면 번호가 소음이 된다. */
  rank?: number;
  /** 최고점 대비 비율(0~1). 박빙인지 압도적인지 숫자만으로는 안 읽힌다. */
  scoreRatio?: number;
  onVotePress: (songId: string, direction: VoteDirection) => void;
  /** 이 곡의 투표 요청이 서버 응답을 기다리는 중. */
  votePending?: boolean;
  isPlaying: boolean;
  isCurrent: boolean;
  onTogglePlay: () => void;
  isExpired?: boolean;
  isHighlighted?: boolean;
  onAddToSetlist?: (songId: string) => void;
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
  scoreRatio = 0,
  onVotePress,
  votePending = false,
  isPlaying,
  isCurrent,
  onTogglePlay,
  isExpired = false,
  isHighlighted = false,
  onAddToSetlist,
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
  const showRank = typeof rank === "number" && rank <= 3;

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

  // Compact (playlist-style) view
  if (viewMode === "compact") {
    return (
      <div className={`bg-surface rounded-xl border transition-all hover:border-border-strong ${showMenu ? "overflow-visible" : "overflow-hidden"} ${isHighlighted ? "border-yellow-500/50 bg-yellow-900/5" : isCurrent ? "border-primary/50" : "border-border"} ${isPending ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-3 p-3">
          {/* 순위 · 재생 상태. 칸은 항상 잡아둔다 — 번호 유무로 썸네일 줄이 어긋나면 안 된다. */}
          <div className="flex w-5 shrink-0 items-center justify-center pt-3.5">
            {isCurrent || showRank ? (
              isCurrent ? (
                <span className="flex h-3 items-end gap-0.5" aria-label="재생 중">
                  {[0, 0.18, 0.36].map((delay) => (
                    <span
                      key={delay}
                      className="w-0.5 rounded-full bg-accent-play animate-eq-bar"
                      style={{ height: "100%", animationDelay: `${delay}s` }}
                    />
                  ))}
                </span>
              ) : (
                <span className="text-caption font-bold tabular-nums text-text-subtle">
                  {String(rank).padStart(2, "0")}
                </span>
              )
            ) : null}
          </div>

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
            {/* 한 줄로 자르면 대여섯 글자에서 끊긴다. 두 줄까지 보여준다. */}
            <h3 className={`font-medium text-sm leading-snug line-clamp-2 ${isCurrent ? "text-primary" : "text-text"}`}>{song.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {artist && (
                <p className="text-caption text-text-muted truncate min-w-0">{artist}</p>
              )}
              {song.commentCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                  className="group/badge -my-3 inline-flex shrink-0 items-center py-3"
                  aria-label={`댓글 ${song.commentCount}개`}
                >
                  {/* 배지는 작게 두되 누르는 자리는 44px 이어야 한다 (AGENTS.md). */}
                  <span className="inline-flex h-5 items-center gap-0.5 rounded-md bg-primary/15 px-1.5 text-[11px] font-semibold text-primary transition-colors group-hover/badge:bg-primary/25">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z" />
                    </svg>
                    {song.commentCount}
                  </span>
                </button>
              )}
              {versionCount > 0 && (
                <button type="button" onClick={() => setShowVersions(true)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-md bg-warning-soft px-1.5 text-[11px] font-semibold text-warning" aria-label={`다른 버전 ${versionCount}개`}>
                  <VersionIcon /> {versionCount}
                </button>
              )}
            </div>
          </div>

          {/* More menu (⋮) */}
          <div className="relative shrink-0" ref={showMenu ? menuRef : undefined}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-text-subtle hover:text-text hover:bg-surface-hover transition-colors"
              aria-label="더보기"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-20 w-44 bg-surface-hover border border-border rounded-xl shadow-lg overflow-hidden">
                {song.added_by && (
                  <div className="px-3 py-2 text-caption text-text-subtle border-b border-border truncate">
                    추가: <span className="text-text-muted">{song.added_by}</span>
                  </div>
                )}
                <button
                  onClick={() => { setShowComments(true); setShowMenu(false); }}
                  className="w-full px-3 py-2.5 text-left text-sm text-text hover:bg-surface-hover transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  댓글
                </button>
                <button onClick={() => { setShowVersions(true); setShowMenu(false); }} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-text hover:bg-surface-hover">
                  <VersionIcon /> 다른 버전 {versionCount > 0 ? `(${versionCount})` : ""}
                </button>
                {onAddToSetlist && (
                  <button
                    onClick={() => { onAddToSetlist(song.id); setShowMenu(false); }}
                    className="w-full px-3 py-2.5 text-left text-sm text-text hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    셋리스트에 추가
                  </button>
                )}
                {canRemove && (
                  <button
                    onClick={() => { handleRemove(); setShowMenu(false); }}
                    disabled={isPending}
                    className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-surface-hover transition-colors flex items-center gap-2"
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
        {/* 최고점 대비 막대. 5 5 4 4 가 숫자로만 있으면 박빙인지 안 읽힌다. */}
        <div className="mx-3 h-0.5 overflow-hidden rounded-pill bg-surface-hover">
          <div
            className={`h-0.5 rounded-pill transition-[width] duration-300 ${isCurrent ? "bg-accent-play" : "bg-border-strong"}`}
            style={{ width: `${Math.round(scoreRatio * 100)}%` }}
          />
        </div>

        {/*
          투표를 아랫줄로 내려 제목 폭을 확보한다. 같은 줄에 두면 제목에 80px 밖에 남지 않는다.
          이미 있는 투표자 줄과 한 줄을 나눠 써서 카드가 더 높아지지 않는다.
        */}
        <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
          <VoterStrip votes={song.votes} hide={votesAnonymous} />
          <div className="ml-auto shrink-0">{voteButtons}</div>
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
            <h3 className={`font-semibold leading-snug line-clamp-2 ${isCurrent ? "text-primary" : "text-text"}`}>{song.title}</h3>
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
              className="text-caption text-text-subtle hover:text-primary transition-colors flex items-center gap-1"
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
