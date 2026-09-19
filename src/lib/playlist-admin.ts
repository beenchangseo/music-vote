import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ARCHIVED_PLAYLIST_MESSAGE, isArchivedPlaylist } from "@/lib/playlist-archive";

/**
 * 합주방 관리 권한 검사. 통과하면 void, 아니면 throw.
 *
 * - 로그인 합주방: creator_user_id === auth.uid() 면 토큰 무관 통과
 * - 보관된 합주방: 기본적으로 거부한다. 방 정리를 위한 삭제만 토큰으로 허용한다.
 */
export async function assertPlaylistAdmin(
  playlistId: string,
  adminToken: string | null,
  options: { allowArchived?: boolean } = {},
): Promise<void> {
  const admin = createAdminClient();

  const { data: playlist } = await admin
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();

  if (!playlist) throw new Error("합주방을 찾을 수 없습니다.");

  if (!isArchivedPlaylist(playlist)) {
    const user = await getCurrentUser();
    if (user && user.id === playlist.creator_user_id) return;
    // 본인이 아니면 토큰을 알아내도 통과시키지 않는다.
    throw new Error("권한이 없습니다.");
  }

  // 보관된 합주방은 방 삭제만 허용한다.
  if (!options.allowArchived) throw new Error(ARCHIVED_PLAYLIST_MESSAGE);
  if (!adminToken) throw new Error("권한이 없습니다.");
  const { data: row } = await admin
    .from("playlist_admin")
    .select("admin_token")
    .eq("playlist_id", playlistId)
    .single();
  if (!row || row.admin_token !== adminToken) {
    throw new Error("권한이 없습니다.");
  }
}
