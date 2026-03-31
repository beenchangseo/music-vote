import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import PlaylistClient from "@/components/PlaylistClient";
import type { Metadata } from "next";
import type { Playlist, Song, Vote, SongWithScore } from "@/lib/types";

interface PageProps {
  params: Promise<{ shareCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareCode } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: playlist } = await supabase
    .from("playlists")
    .select("title, share_code")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) return { title: "Music Vote" };

  const { data: playlistData } = await supabase
    .from("playlists")
    .select("id")
    .eq("share_code", shareCode)
    .single();

  const playlistId = playlistData?.id || "";

  const { count: songCount } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId);

  // Count unique participants
  const { data: songIds } = await supabase
    .from("songs")
    .select("id")
    .eq("playlist_id", playlistId);

  let participantCount = 0;
  if (songIds && songIds.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("nickname")
      .in("song_id", songIds.map((s: { id: string }) => s.id));
    if (votes) {
      const uniqueNicknames = new Set(votes.map((v: { nickname: string }) => v.nickname.toLowerCase()));
      participantCount = uniqueNicknames.size;
    }
  }

  const metaTitle = `${playlist.title} - Music Vote`;
  const description = participantCount > 0
    ? `${songCount || 0}곡 등록 · ${participantCount}명 참여 중`
    : `${songCount || 0}곡 등록 | 밴드 곡 투표에 참여하세요!`;

  return {
    title: metaTitle,
    description,
    openGraph: {
      title: metaTitle,
      description,
      type: "website",
      images: [`/api/og?title=${encodeURIComponent(playlist.title)}&songs=${songCount || 0}&participants=${participantCount}`],
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
    .select("id, title, share_code, deadline, created_at")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) notFound();

  const { data: songs } = await supabase
    .from("songs")
    .select("*")
    .eq("playlist_id", playlist.id)
    .order("created_at", { ascending: true });

  const songIds = (songs || []).map((s: Song) => s.id);
  const { data: votes } = songIds.length > 0
    ? await supabase
        .from("votes")
        .select("*")
        .in("song_id", songIds)
    : { data: [] as Vote[] };

  const songsWithScores: SongWithScore[] = (songs || []).map((song: Song) => {
    const songVotes = (votes || []).filter((v: Vote) => v.song_id === song.id);
    const score = songVotes.reduce((sum: number, v: Vote) => sum + v.vote_type, 0);
    return { ...song, score, votes: songVotes, userVote: null };
  });

  songsWithScores.sort((a, b) => b.score - a.score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <PlaylistClient
      playlist={playlist as Playlist}
      songs={songsWithScores}
      shareCode={shareCode}
    />
  );
}
