import { createAdminClient } from "@/lib/supabase/server";

/**
 * 보관된 합주방: 카카오 로그인을 도입하기 전에 만들어진 익명 합주방.
 * `creator_user_id` 가 비어 있어 표와 글을 계정으로 묶을 수 없다.
 * 지난 기록은 그대로 볼 수 있지만 새로 쓸 수는 없다.
 */
export const ARCHIVED_PLAYLIST_MESSAGE =
  "보관된 합주방이에요. 지난 기록은 그대로 볼 수 있지만 새로 쓸 수는 없어요.";

export function isArchivedPlaylist(playlist: { creator_user_id: string | null }): boolean {
  return !playlist.creator_user_id;
}

/** 합주방 id 로 보관 여부를 확인한다. */
export async function isArchivedPlaylistId(playlistId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();
  return !data || isArchivedPlaylist(data);
}

/** 쓰기 가능한 합주방인지 확인한다. 보관된 합주방이면 throw. */
export async function assertPlaylistWritable(playlistId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();

  if (!data) throw new Error("합주방을 찾을 수 없습니다.");
  if (isArchivedPlaylist(data)) throw new Error(ARCHIVED_PLAYLIST_MESSAGE);
}

/** 곡이 속한 합주방이 쓰기 가능한지 확인하고 합주방 id 를 돌려준다. */
export async function assertPlaylistWritableBySong(songId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("songs")
    .select("playlist_id, playlists!inner(creator_user_id)")
    .eq("id", songId)
    .single<{ playlist_id: string; playlists: { creator_user_id: string | null } }>();

  if (!data) throw new Error("곡을 찾을 수 없습니다.");
  if (isArchivedPlaylist(data.playlists)) throw new Error(ARCHIVED_PLAYLIST_MESSAGE);
  return data.playlist_id;
}
