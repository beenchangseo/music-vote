"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import VoteButtons from "./VoteButtons";
import CommentModal from "./CommentModal";
import SongVersionModal from "./SongVersionModal";
import { ActionTab, ActionTabBar } from "../ui/ActionTab";
import Badge from "../ui/Badge";
import { useDialog } from "../ui/DialogProvider";
import IconButton from "../ui/IconButton";
import { ListRowButton, SongRow, SongRowTitleButton } from "../ui/ListRow";
import Modal from "../ui/Modal";
import { removeSong } from "@/actions/song";
import type { VoteDirection } from "@/domain/vote";
import { displayArtist, displayTitle } from "@/domain/song-meta";
import type { SongWithScore, VotingMode } from "@/domain/types";
import { ChevronIcon, CommentIcon, InSetlistIcon, MoreIcon, PlayPauseIcon, SetlistAddIcon, TrashIcon, VersionsIcon } from "@/components/ui/icons";

interface SongCardProps {
  song: SongWithScore;
  votingMode: VotingMode;
  nickname: string;
  shareCode: string;
  playlistId: string;
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
}

export default function SongCard({
  song,
  votingMode,
  nickname,
  shareCode,
  playlistId,
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
}: SongCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versionCount, setVersionCount] = useState(song.versionCount);
  const { showDanger, showAlert } = useDialog();

  async function handleRemove() {
    const ok = await showDanger(`"${song.title}"을(를) 삭제할까요?`);
    if (!ok) return;

    startTransition(async () => {
      try {
        await removeSong(song.id, playlistId, shareCode);
      } catch {
        showAlert("곡을 삭제하지 못했어요");
      }
    });
  }

  const canRemove = song.canDelete;
  const hasMenu = canRemove || !!song.added_by;
  // YouTube 채널명이 아티스트가 아닌 경우가 많다. 표시할 때만 정제한다.
  const artist = displayArtist(song.artist, song.title);
  // 유튜브 원제목에서 아티스트 앞부분과 [가사/Lyrics] 같은 태그를 뗀 제목. 원제목은 펼친 행에 남긴다.
  const title = displayTitle(song.title);
  const actionsId = `song-actions-${song.id}`;

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

  // 디자인 E1 (LinkedIn · Grab): no pill backgrounds, one hairline, tabs share the width. The opened row and the
  // video card draw the same bar, so a song's actions read the same in both views.
  const actions = (
    <ActionTabBar id={actionsId}>
      <ActionTab icon={<CommentIcon />} onClick={() => setShowComments(true)}>
        {song.commentCount > 0 ? `댓글 ${song.commentCount}` : "댓글"}
      </ActionTab>
      <ActionTab icon={<VersionsIcon />} onClick={() => setShowVersions(true)}>
        {versionCount > 0 ? `버전 ${versionCount}` : "버전"}
      </ActionTab>
      {/* 셋리스트는 ⋯ 안에 숨기면 못 찾는다. 상태를 글자로 보이고, 누르면 넣거나 뺀다. */}
      {inSetlist && onRemoveFromSetlist ? (
        <ActionTab icon={<InSetlistIcon />} selected onClick={() => onRemoveFromSetlist(song.id)}>
          셋리스트에 있음<span className="sr-only">, 빼기</span>
        </ActionTab>
      ) : inSetlist ? (
        <ActionTab icon={<InSetlistIcon />} selected>
          셋리스트에 있음
        </ActionTab>
      ) : onAddToSetlist ? (
        <ActionTab icon={<SetlistAddIcon />} onClick={() => onAddToSetlist(song.id)}>
          셋리스트에 추가
        </ActionTab>
      ) : null}
      {hasMenu && (
        <IconButton bare onClick={() => setShowMenu(true)} aria-label={`${title} 더보기`}>
          <MoreIcon className="size-4.5" />
        </IconButton>
      )}
    </ActionTabBar>
  );

  const sheets = (
    <>
      <Modal open={showMenu} onClose={() => setShowMenu(false)} title={title}>
        {song.added_by && (
          <p className="text-sm text-text-muted">
            추가: <span className="text-text">{song.added_by}</span>
          </p>
        )}
        {canRemove && (
          <ListRowButton
            onClick={() => {
              setShowMenu(false);
              void handleRemove();
            }}
            disabled={isPending}
            className={song.added_by ? "mt-2" : ""}
            leading={
              <TrashIcon className="size-5 text-danger-fg" />
            }
          >
            <span className="text-body text-danger-fg">곡 삭제</span>
          </ListRowButton>
        )}
      </Modal>
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
        <SongVersionModal songId={song.id} songTitle={title} shareCode={shareCode} loginGate={loginGate} onCountChange={setVersionCount} onClose={() => setShowVersions(false)} />
      )}
    </>
  );

  // Compact view (디자인 C9): one row of rank, cover, title and the vote pill. Tapping the title opens
  // the row in place with comments, versions, setlist and the menu, so the list stays one line per song.
  if (viewMode === "compact") {
    const topRank = rank != null && rank <= 3 && song.score > 0;
    return (
      <SongRow
        surface={expanded ? "open" : "hover"}
        className={`${isHighlighted ? "ring-1 ring-inset ring-warning/40" : ""} ${isPending ? "opacity-50" : ""}`}
        rank={rank}
        topRank={topRank}
        trailing={voteButtons}
        footer={
          <>
            {expanded && actions}
            {sheets}
          </>
        }
        cover={
          // Spotify: tap the art to play.
          <button
            onClick={onTogglePlay}
            className="group absolute inset-0"
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
                <span className="flex h-4 items-end gap-0.5" aria-hidden>
                  {["0ms", "150ms", "300ms"].map((delay) => (
                    <span key={delay} className="h-full w-0.5 origin-bottom animate-eq-bar rounded-pill bg-accent-play" style={{ animationDelay: delay }} />
                  ))}
                </span>
              ) : (
                <PlayPauseIcon playing={false} className={`size-5 text-white ${isCurrent ? "" : "opacity-0 transition-opacity group-hover:opacity-100"}`} />
              )}
            </span>
          </button>
        }
      >
        <div className={expanded ? "py-2" : ""}>
          <SongRowTitleButton onClick={onToggleExpand} aria-expanded={expanded} aria-controls={actionsId}>
            <span className={`line-clamp-2 text-body font-semibold leading-snug ${isCurrent ? "text-accent-play" : "text-text"}`}>
              {title}
            </span>
            {/* The second line is ~140px wide: the artist gets the room, comments and setlist are small marks. */}
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-text-muted">
              {artist && <span className="truncate">{artist}</span>}
              {song.commentCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                  <CommentIcon className="size-3" />
                  <span className="sr-only">댓글</span>
                  {song.commentCount}
                </span>
              )}
              {inSetlist && (
                <span className="inline-flex shrink-0 items-center text-primary-fg">
                  <InSetlistIcon className="size-3.5" />
                  <span className="sr-only">셋리스트에 있음</span>
                </span>
              )}
              <ChevronIcon direction="down" className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </span>
          </SongRowTitleButton>
          {/* Opened: the YouTube title before cleanup and the named voters sit under the title, in its column. */}
          {expanded && title !== song.title.trim() && (
            <p className="line-clamp-2 break-all text-caption text-text-subtle">원래 제목 · {song.title}</p>
          )}
          {expanded && <VoterStrip votes={song.votes} hide={votesAnonymous} />}
        </div>
      </SongRow>
    );
  }

  // Card (video) view
  return (
    <div className={`bg-surface rounded-card border overflow-hidden transition-colors hover:border-border-strong ${isCurrent ? "border-primary/50" : "border-border"} ${isPending ? "opacity-50" : ""}`}>
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
          <div className={`w-14 h-14 flex items-center justify-center rounded-pill transition-colors ${isCurrent ? "bg-primary text-on-primary group-hover:bg-primary-hover" : "bg-danger text-on-danger group-hover:bg-danger-hover"}`}>
            <PlayPauseIcon playing={isPlaying} className="size-6" />
          </div>
        </div>
        {isCurrent && (
          <Badge tone="primary" className="absolute left-2 top-2">
            재생 중
          </Badge>
        )}
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold leading-snug line-clamp-2 ${isCurrent ? "text-primary-fg" : "text-text"}`}>{title}</h3>
            {artist && (
              <p className="text-sm text-text-muted truncate mt-0.5">{artist}</p>
            )}
          </div>
          <div className="shrink-0">{voteButtons}</div>
        </div>
      </div>
      {actions}
      {sheets}
    </div>
  );
}

// 기명 투표 모드에서 펼친 행에 투표한 사람을 보인다. 한 번에 한 행만 펼쳐서 이름을 바로 깐다.
function VoterStrip({
  votes,
  hide,
}: {
  votes: { vote_type: number; nickname: string }[];
  hide: boolean;
}) {
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

  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-text-muted">
      {up.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <ChevronIcon direction="up" className="size-3 text-success" />
          <span className="sr-only">찬성</span>
          {up.length}
        </span>
      )}
      {down.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <ChevronIcon direction="down" className="size-3 text-danger-fg" />
          <span className="sr-only">반대</span>
          {down.length}
        </span>
      )}
      <span className="min-w-0 flex-1 text-text-subtle">
        {up.length > 0 && <span className="break-keep">{up.join(" · ")}</span>}
        {up.length > 0 && down.length > 0 && <span className="mx-1">/</span>}
        {down.length > 0 && <span className="break-keep">{down.join(" · ")}</span>}
      </span>
    </div>
  );
}
