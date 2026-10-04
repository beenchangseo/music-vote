import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import MetronomeClient from "@/components/MetronomeClient";
import type { Song } from "@/lib/types";

interface PageProps {
  params: Promise<{ shareCode: string }>;
  searchParams: Promise<{ bpm?: string; songId?: string }>;
}

export default async function MetronomePage({ params, searchParams }: PageProps) {
  const { shareCode } = await params;
  const { bpm, songId } = await searchParams;
  // playlists and songs are closed to the public key (v18), so read with service_role.
  const admin = createAdminClient();

  const { data: playlist } = await admin
    .from("playlists")
    .select("id, title")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) notFound();

  const { data: songs } = await admin
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
