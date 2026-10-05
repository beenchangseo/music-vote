import { cache } from "react";
import { notFound } from "next/navigation";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { shouldExposeVoters } from "@/lib/vote-domain";
import { getMyTeams, type MyTeam } from "@/actions/team";
import PlaylistClient from "@/components/PlaylistClient";
import type { Metadata } from "next";
import type { Playlist, RoomTeam, Song, SongWithScore } from "@/lib/types";

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
  "id, title, share_code, deadline, created_at, setlist_count, announcement, setlist_confirmed, creator_nickname, creator_user_id, votes_anonymous, voting_mode, default_vote_limit, setlist_edit_mode, team_id";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * 팀 방의 밴드와 내 멤버 여부. teams·team_members 는 공개 키로 못 읽으므로 service_role (v19).
 * 실패해도 방 화면은 그대로 뜨게 null + console.error.
 */
async function loadRoomBand(
  admin: Admin,
  teamId: string,
  userId: string | null,
): Promise<{ id: string; name: string; nextShowAt: string | null; isMember: boolean } | null> {
  const [teamRes, memberRes] = await Promise.all([
    admin.from("teams").select("id, name, next_show_at").eq("id", teamId).maybeSingle(),
    userId
      ? admin.from("team_members").select("user_id").eq("team_id", teamId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const error = teamRes.error ?? memberRes.error;
  if (error) {
    console.error(`[playlist] 밴드 조회 실패 (teamId=${teamId}):`, error.code);
    return null;
  }
  if (!teamRes.data) return null;
  return {
    id: teamRes.data.id,
    name: teamRes.data.name,
    nextShowAt: teamRes.data.next_show_at ?? null,
    isMember: !!memberRes.data,
  };
}

/**
 * generateMetadata 와 페이지가 같은 합주방을 각각 조회하던 것을 한 번으로 묶는다.
 * 요청 하나 안에서만 공유하므로 값이 낡을 일은 없다.
 */
const getPlaylistByShareCode = cache(async (shareCode: string) => {
  // playlists is closed to the public key (v18), so read it with service_role.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("playlists")
    .select(PLAYLIST_COLUMNS)
    .eq("share_code", shareCode)
    .single();
  // PGRST116 means no row: a genuine 404. Anything else is a broken read path
  // and must not hide behind "room not found".
  if (error && error.code !== "PGRST116") {
    console.error(`[playlist] 플레이리스트 조회 실패 (shareCode=${shareCode}):`, error.message);
  }
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
  if (!playlist) return { title: "Plypick", robots: { index: false } };

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
    // Rooms are private links shared in group chats; keep them out of search results.
    robots: { index: false },
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
  // Views that compute "my vote" from auth.uid() stay on the session client;
  // the songs table itself is closed to the public key (v18).
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  // 계정 확인은 합주방 조회와 무관하므로 같이 보낸다.
  const [playlist, currentUser] = await Promise.all([
    getPlaylistByShareCode(shareCode),
    getCurrentUser(),
  ]);

  if (!playlist) notFound();

  // 익명 모드에서는 누가 어디에 찍었는지를 아예 조회하지 않는다.
  const exposeVoters = shouldExposeVoters(playlist);
  const isRoomOwner = !!currentUser && currentUser.id === playlist.creator_user_id;
  const teamId = playlist.team_id ?? null;
  // "이 플레이리스트를 내 밴드에 넣기" 후보와 안내 카드(F7) 조건은 방장 · 팀 없는 방에서만 필요하다.
  const wantsBandPrompt = isRoomOwner && !teamId;

  // 집계 뷰가 playlist_id 를 들고 있어(v16) 곡 목록을 기다리지 않는다.
  // 밴드 조회도 같은 Promise.all 에 넣어 순차 왕복 2번을 유지한다 (eng D4).
  const [songsResult, stats, summaryResult, votersResult, engagementResult, band, myTeams, memberCountResult] =
    await Promise.all([
      admin
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
      teamId ? loadRoomBand(admin, teamId, currentUser?.id ?? null) : Promise.resolve(null),
      wantsBandPrompt ? getMyTeams() : Promise.resolve([] as MyTeam[]),
      // Logged-in members of the room, not voters (playlist_stats.participant_count counts voters, v15:101).
      wantsBandPrompt
        ? admin.from("playlist_members").select("user_id", { count: "exact", head: true }).eq("playlist_id", playlist.id)
        : Promise.resolve(null),
    ]);

  // Payload rules per field: the band link and name only reach members (the name also reaches the
  // room owner for "{밴드} 의 방"); the invite code never reaches the room screen (R10).
  const roomTeam: RoomTeam | null = band
    ? {
        id: band.isMember ? band.id : null,
        name: band.isMember || isRoomOwner ? band.name : null,
        nextShowAt: band.nextShowAt,
        isMember: band.isMember,
      }
    : null;
  const memberCount = memberCountResult && !memberCountResult.error ? memberCountResult.count ?? 0 : null;

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
      team={roomTeam}
      myTeams={myTeams}
      memberCount={memberCount}
    />
  );
}
