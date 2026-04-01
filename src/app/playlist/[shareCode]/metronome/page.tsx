import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import MetronomeClient from "@/components/MetronomeClient";
import type { Song } from "@/lib/types";

interface PageProps {
  params: Promise<{ shareCode: string }>;
  searchParams: Promise<{ bpm?: string; songId?: string }>;
}

export default async function MetronomePage({ params, searchParams }: PageProps) {
  const { shareCode } = await params;
  const { bpm, songId } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, title")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) notFound();

  const { data: songs } = await supabase
    .from("songs")
    .select("id, title, artist, tempo_bpm")
    .eq("playlist_id", playlist.id)
    .not("tempo_bpm", "is", null)
    .order("created_at", { ascending: true });

  const songsWithTempo = (songs || []) as Pick<Song, "id" | "title" | "artist" | "tempo_bpm">[];

  return (
    <MetronomeClient
      shareCode={shareCode}
      playlistTitle={playlist.title}
      songs={songsWithTempo}
      initialBpm={bpm ? parseInt(bpm) : undefined}
      initialSongId={songId}
    />
  );
}
