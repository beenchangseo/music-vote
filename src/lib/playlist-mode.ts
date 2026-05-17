import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 신규(로그인 강제) 모드: playlists.creator_user_id IS NOT NULL.
 * 기존 익명 플레이리스트는 NULL → 종전 nickname 흐름 유지.
 */
export async function getPlaylistModeById(
  playlistId: string,
): Promise<{ requiresLogin: boolean }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();
  return { requiresLogin: !!data?.creator_user_id };
}

export async function getPlaylistModeBySong(
  songId: string,
): Promise<{ requiresLogin: boolean; playlistId: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("songs")
    .select("playlist_id, playlists!inner(creator_user_id)")
    .eq("id", songId)
    .single<{ playlist_id: string; playlists: { creator_user_id: string | null } }>();
  if (!data) return { requiresLogin: false, playlistId: null };
  return {
    requiresLogin: !!data.playlists.creator_user_id,
    playlistId: data.playlist_id,
  };
}
