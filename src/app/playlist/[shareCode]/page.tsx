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

interface PageProps {
  params: Promise<{ shareCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareCode } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, title")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) return { title: "Plypick" };

  // 후보곡·참여자 수는 playlist_stats 뷰에서 집계한다 (v14).
  const { data: stats } = await supabase
    .from("playlist_stats")
    .select("song_count, participant_count")
    .eq("playlist_id", playlist.id)
    .single();

  const songCount: number = stats?.song_count ?? 0;
  const participantCount: number = stats?.participant_count ?? 0;

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

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, title, share_code, deadline, created_at, setlist_count, announcement, setlist_confirmed, creator_nickname, creator_user_id, votes_anonymous, voting_mode, default_vote_limit, setlist_edit_mode")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) notFound();

  const [{ data: songs }, { data: stats }] = await Promise.all([
    supabase
      .from("songs")
      .select("*")
      .eq("playlist_id", playlist.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("playlist_stats")
      .select("participant_count")
      .eq("playlist_id", playlist.id)
      .single(),
  ]);

  // 익명 모드에서는 누가 어디에 찍었는지를 아예 조회하지 않는다.
  // 화면에서 가리기만 하면 페이로드에 그대로 남는다.
  const exposeVoters = shouldExposeVoters(playlist as Playlist);

  const songIds = (songs || []).map((s: Song) => s.id);
  const [summaryResult, votersResult, commentsResult, versionsResult] = songIds.length > 0
    ? await Promise.all([
        supabase
          .from("song_vote_summary")
          .select("song_id, score, my_vote_count, my_vote_type")
          .in("song_id", songIds),
        exposeVoters
          ? supabase.from("song_voters").select("song_id, nickname, vote_type").in("song_id", songIds)
          : Promise.resolve({ data: [] as VoterRow[] }),
        supabase.from("comments").select("song_id").in("song_id", songIds),
        supabase.from("song_versions").select("song_id").in("song_id", songIds),
      ])
    : [
        { data: [] as VoteSummaryRow[] },
        { data: [] as VoterRow[] },
        { data: [] as { song_id: string }[] },
        { data: [] as { song_id: string }[] },
      ];

  const summaryMap = new Map<string, VoteSummaryRow>();
  for (const row of (summaryResult.data || []) as VoteSummaryRow[]) {
    summaryMap.set(row.song_id, row);
  }
  const votersMap: Record<string, VoterRow[]> = {};
  for (const voter of (votersResult.data || []) as VoterRow[]) {
    (votersMap[voter.song_id] ??= []).push(voter);
  }

  const commentRows = (commentsResult.data || []) as { song_id: string }[];
  const commentCountMap: Record<string, number> = {};
  for (const c of commentRows) {
    commentCountMap[c.song_id] = (commentCountMap[c.song_id] || 0) + 1;
  }
  const versionCountMap: Record<string, number> = {};
  for (const version of versionsResult.data || []) {
    versionCountMap[version.song_id] = (versionCountMap[version.song_id] || 0) + 1;
  }

  const currentUser = await getCurrentUser();

  const songsWithScores: SongWithScore[] = (songs || []).map((song: Song) => {
    const summary = summaryMap.get(song.id);
    return {
      ...song,
      score: summary?.score ?? 0,
      votes: votersMap[song.id] ?? [],
      userVote: summary?.my_vote_type ?? null,
      userVoteCount: summary?.my_vote_count ?? 0,
      commentCount: commentCountMap[song.id] ?? 0,
      versionCount: versionCountMap[song.id] ?? 0,
    };
  });

  songsWithScores.sort((a, b) => b.score - a.score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <PlaylistClient
      playlist={playlist as Playlist}
      songs={songsWithScores}
      shareCode={shareCode}
      participantCount={stats?.participant_count ?? 0}
      userNickname={currentUser?.nickname}
      currentUserId={currentUser?.id ?? null}
      currentUserAvatarUrl={currentUser?.avatarUrl ?? null}
    />
  );
}
