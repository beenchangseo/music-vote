import { cache } from "react";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { shouldExposeVoters } from "@/lib/vote-domain";
import PlaylistClient from "@/components/PlaylistClient";
import type { Metadata } from "next";
import type { Playlist, Song, SongWithScore } from "@/lib/types";

/** song_vote_summary 뷰. 점수와 내 표만 담고 다른 사람의 신원은 담지 않는다. */
type VoteSummaryRow = {
  song_id: string;
  score: number | null;
  my_vote_count: number | null;
  my_vote_type: number | null;
};

/** song_voters 뷰. 기명 합주방에서만 행이 나온다. */
type VoterRow = {
  song_id: string;
  nickname: string;
  vote_type: number;
};

/** song_engagement_counts 뷰. 댓글과 다른 버전은 개수만 쓴다. */
type EngagementRow = {
  song_id: string;
  comment_count: number | null;
  version_count: number | null;
};

const PLAYLIST_COLUMNS =
  "id, title, share_code, deadline, created_at, setlist_count, announcement, setlist_confirmed, creator_nickname, creator_user_id, votes_anonymous, voting_mode, default_vote_limit, setlist_edit_mode";

/**
 * generateMetadata 와 페이지가 같은 합주방을 각각 조회하던 것을 한 번으로 묶는다.
 * 요청 하나 안에서만 공유하므로 값이 낡을 일은 없다.
 */
const getPlaylistByShareCode = cache(async (shareCode: string) => {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("playlists")
    .select(PLAYLIST_COLUMNS)
    .eq("share_code", shareCode)
    .single();
  return (data as Playlist) ?? null;
});

const getPlaylistStats = cache(async (playlistId: string) => {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("playlist_stats")
    .select("song_count, participant_count")
    .eq("playlist_id", playlistId)
    .single();
  return (data as { song_count: number; participant_count: number }) ?? null;
});

interface PageProps {
  params: Promise<{ shareCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareCode } = await params;
  const playlist = await getPlaylistByShareCode(shareCode);
  if (!playlist) return { title: "Plypick" };

  const stats = await getPlaylistStats(playlist.id);
  const songCount = stats?.song_count ?? 0;
  const participantCount = stats?.participant_count ?? 0;

  const metaTitle = `${playlist.title} - Plypick`;
  const description = participantCount > 0
    ? `${songCount}곡 등록 · ${participantCount}명 참여 중`
    : `${songCount}곡 등록 | 밴드 곡 투표에 참여하세요!`;

  return {
    title: metaTitle,
    description,
    openGraph: {
      title: metaTitle,
      description,
      type: "website",
      images: [`/api/og?title=${encodeURIComponent(playlist.title)}&songs=${songCount}&participants=${participantCount}`],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description,
    },
  };
}

export default async function PlaylistPage({ params }: PageProps) {
  const { shareCode } = await params;
  const supabase = await createServerSupabaseClient();

  // 계정 확인은 합주방 조회와 무관하므로 같이 보낸다.
  const [playlist, currentUser] = await Promise.all([
    getPlaylistByShareCode(shareCode),
    getCurrentUser(),
  ]);

  if (!playlist) notFound();

  // 익명 모드에서는 누가 어디에 찍었는지를 아예 조회하지 않는다.
  const exposeVoters = shouldExposeVoters(playlist);

  // 집계 뷰가 playlist_id 를 들고 있어(v16) 곡 목록을 기다리지 않는다.
  const [songsResult, stats, summaryResult, votersResult, engagementResult] =
    await Promise.all([
      supabase
        .from("songs")
        .select("*")
        .eq("playlist_id", playlist.id)
        .order("created_at", { ascending: true }),
      getPlaylistStats(playlist.id),
      supabase
        .from("song_vote_summary")
        .select("song_id, score, my_vote_count, my_vote_type")
        .eq("playlist_id", playlist.id),
      exposeVoters
        ? supabase
            .from("song_voters")
            .select("song_id, nickname, vote_type")
            .eq("playlist_id", playlist.id)
        : Promise.resolve({ data: [] as VoterRow[], error: null }),
      supabase
        .from("song_engagement_counts")
        .select("song_id, comment_count, version_count")
        .eq("playlist_id", playlist.id),
    ]);

  // 뷰가 없으면 점수가 전부 0 으로 보인다. 배포 순서를 틀렸을 때 바로 알아채도록 남긴다.
  if (summaryResult.error) {
    console.error(
      "[playlist] song_vote_summary 조회 실패 — supabase-migration-v16.sql 적용 여부 확인:",
      summaryResult.error.message,
    );
  }

  const songs = songsResult.data;

  const summaryMap = new Map<string, VoteSummaryRow>();
  for (const row of (summaryResult.data || []) as VoteSummaryRow[]) {
    summaryMap.set(row.song_id, row);
  }
  const votersMap: Record<string, VoterRow[]> = {};
  for (const voter of (votersResult.data || []) as VoterRow[]) {
    (votersMap[voter.song_id] ??= []).push(voter);
  }
  const engagementMap = new Map<string, EngagementRow>();
  for (const row of (engagementResult.data || []) as EngagementRow[]) {
    engagementMap.set(row.song_id, row);
  }

  const songsWithScores: SongWithScore[] = (songs || []).map((song: Song) => {
    const summary = summaryMap.get(song.id);
    const engagement = engagementMap.get(song.id);
    return {
      ...song,
      score: summary?.score ?? 0,
      votes: votersMap[song.id] ?? [],
      userVote: summary?.my_vote_type ?? null,
      userVoteCount: summary?.my_vote_count ?? 0,
      commentCount: engagement?.comment_count ?? 0,
      versionCount: engagement?.version_count ?? 0,
    };
  });

  songsWithScores.sort((a, b) => b.score - a.score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <PlaylistClient
      playlist={playlist}
      songs={songsWithScores}
      shareCode={shareCode}
      participantCount={stats?.participant_count ?? 0}
      userNickname={currentUser?.nickname}
      currentUserId={currentUser?.id ?? null}
      currentUserAvatarUrl={currentUser?.avatarUrl ?? null}
    />
  );
}
