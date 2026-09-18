"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { castVote } from "@/actions/vote";
import { track } from "@/lib/analytics";
import { applyVotePress, type VoteDirection } from "@/lib/vote-domain";
import type { SongWithScore, VoteAllowance, VotingMode } from "@/lib/types";

export const VOTE_LIMIT_REACHED_MESSAGE =
  "투표권을 모두 사용했어요. 기존 표를 취소하면 다시 투표할 수 있어요.";
export const VOTE_FAILED_MESSAGE = "투표에 실패했어요. 잠시 후 다시 시도해 주세요.";

interface VoteSnapshot {
  score: number;
  userVote: number | null;
  userVoteCount: number;
}

/**
 * 낙관적 투표 상태. base 는 이 값을 만들 때 서버가 알려준 값이고,
 * 서버가 base 와 달라지면(= 반영되었거나 다른 사람 표가 들어오면) 버린다.
 */
interface VoteOverride {
  base: VoteSnapshot;
  next: VoteSnapshot;
}

interface UsePlaylistVotesOptions {
  songs: SongWithScore[];
  votingMode: VotingMode;
  shareCode: string;
  nickname: string;
  allowance: VoteAllowance | null;
  onAllowanceChange: (usedVotes: number, voteLimit: number) => void;
  onError: (message: string) => void;
  /** 표가 서버에 저장된 뒤 같은 합주방의 다른 화면에 알린다. */
  onSaved?: () => void;
}

function sameSnapshot(a: VoteSnapshot, b: VoteSnapshot): boolean {
  return (
    a.score === b.score &&
    a.userVote === b.userVote &&
    a.userVoteCount === b.userVoteCount
  );
}

function snapshotOf(song: SongWithScore): VoteSnapshot {
  return {
    score: song.score,
    userVote: song.userVote,
    userVoteCount: song.userVoteCount,
  };
}

/**
 * 합주방 투표의 단일 상태 소스.
 * 점수와 내 표를 한 곳에서 관리해, 서버 갱신이 들어와도 화면이 갈라지지 않는다.
 */
export function usePlaylistVotes({
  songs,
  votingMode,
  shareCode,
  nickname,
  allowance,
  onAllowanceChange,
  onError,
  onSaved,
}: UsePlaylistVotesOptions) {
  const [overrides, setOverrides] = useState<Record<string, VoteOverride>>({});
  const [pendingSongIds, setPendingSongIds] = useState<Record<string, true>>({});
  const [, startTransition] = useTransition();
  // 같은 틱의 더블탭은 리렌더 전이라 상태로는 막히지 않는다.
  const inFlightRef = useRef<Set<string>>(new Set());

  const songsWithVotes = useMemo(() => {
    const mapped = songs.map((song) => {
      const override = overrides[song.id];
      if (!override || !sameSnapshot(override.base, snapshotOf(song))) return song;
      return { ...song, ...override.next };
    });
    return mapped.sort(
      (a, b) =>
        b.score - a.score ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [songs, overrides]);

  const clearOverride = useCallback((songId: string) => {
    setOverrides((prev) => {
      if (!(songId in prev)) return prev;
      const next = { ...prev };
      delete next[songId];
      return next;
    });
  }, []);

  const pressVote = useCallback(
    (songId: string, direction: VoteDirection) => {
      if (inFlightRef.current.has(songId) || !nickname) return;

      const serverSong = songs.find((s) => s.id === songId);
      const shownSong = songsWithVotes.find((s) => s.id === songId);
      if (!serverSong || !shownSong) return;

      const currentDirection =
        shownSong.userVote === 1 || shownSong.userVote === -1 ? shownSong.userVote : null;
      const next = applyVotePress(
        { direction: currentDirection, count: shownSong.userVoteCount },
        direction,
        votingMode,
      );

      const exhausted =
        allowance?.mode === "allocated" && allowance.usedVotes >= allowance.voteLimit;
      if (exhausted && next.usageDelta > 0) {
        onError(VOTE_LIMIT_REACHED_MESSAGE);
        return;
      }

      setOverrides((prev) => ({
        ...prev,
        [songId]: {
          base: snapshotOf(serverSong),
          next: {
            score: shownSong.score + next.scoreDelta,
            userVote: next.direction,
            userVoteCount: next.count,
          },
        },
      }));
      inFlightRef.current.add(songId);
      setPendingSongIds((prev) => ({ ...prev, [songId]: true }));

      if (next.action === "changed" && currentDirection !== null) {
        track("vote_changed", { from: currentDirection, to: direction });
      } else if (next.action === "removed") {
        track("vote_toggled", { vote_type: currentDirection ?? direction });
      } else {
        track("vote_cast", { vote_type: direction });
      }

      startTransition(async () => {
        try {
          const result = await castVote(songId, nickname, direction, shareCode);
          if (!result.success) {
            clearOverride(songId);
            if (result.reason === "vote_limit_reached") onError(VOTE_LIMIT_REACHED_MESSAGE);
            return;
          }
          if (result.allowance) {
            onAllowanceChange(result.allowance.usedVotes, result.allowance.voteLimit);
          }
          onSaved?.();
        } catch {
          clearOverride(songId);
          onError(VOTE_FAILED_MESSAGE);
        } finally {
          inFlightRef.current.delete(songId);
          setPendingSongIds((prev) => {
            const rest = { ...prev };
            delete rest[songId];
            return rest;
          });
        }
      });
    },
    [
      allowance,
      clearOverride,
      nickname,
      onAllowanceChange,
      onError,
      onSaved,
      shareCode,
      songs,
      songsWithVotes,
      votingMode,
    ],
  );

  const isVotePending = useCallback(
    (songId: string) => !!pendingSongIds[songId],
    [pendingSongIds],
  );

  /** 방장이 표를 초기화하면 남은 낙관적 값도 함께 버린다. */
  const resetVotes = useCallback(() => setOverrides({}), []);

  return { songsWithVotes, pressVote, isVotePending, resetVotes };
}
