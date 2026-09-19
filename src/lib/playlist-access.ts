// 서버 전용. service_role 클라이언트를 쓰므로 화면에서 import 하지 않는다.
// 화면이 필요한 순수 판정은 playlist-archive 에 있다.
import { createAdminClient } from "@/lib/supabase/server";
import { ARCHIVED_PLAYLIST_MESSAGE, isArchivedPlaylist } from "@/lib/playlist-archive";

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
