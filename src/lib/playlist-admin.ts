import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ARCHIVED_PLAYLIST_MESSAGE } from "@/domain/playlist-archive";
import { hostDenial, type HostDenial } from "@/domain/playlist-host";

export type PlaylistAdminDenial = "playlist_not_found" | HostDenial;

/** 방장 쓰기를 받을지. 되면 null, 안 되면 그 이유. 화면이 방장 버튼을 그리는 hostDenial 과 같은 판정이다. */
export async function playlistAdminDenial(playlistId: string): Promise<PlaylistAdminDenial | null> {
  const { data: playlist } = await createAdminClient()
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();

  if (!playlist) return "playlist_not_found";
  return hostDenial(playlist, (await getCurrentUser())?.id);
}

const PLAYLIST_ADMIN_ERRORS: Record<PlaylistAdminDenial, string> = {
  playlist_not_found: "플레이리스트를 찾을 수 없습니다.",
  archived: ARCHIVED_PLAYLIST_MESSAGE,
  not_logged_in: "권한이 없습니다.",
  not_host: "권한이 없습니다.",
};

/**
 * throw 하는 옛 모양의 방장 액션이 쓴다.
 * archived 는 방 삭제만 넘긴다. 보관된 합주방은 남은 링크 토큰으로 지울 수만 있다(ADR 0012).
 */
export async function assertPlaylistAdmin(playlistId: string, archived?: { adminToken: string | null }): Promise<void> {
  const denial = await playlistAdminDenial(playlistId);
  if (!denial) return;
  if (denial !== "archived" || !archived) throw new Error(PLAYLIST_ADMIN_ERRORS[denial]);
  if (!archived.adminToken) throw new Error("권한이 없습니다.");

  const { data: row } = await createAdminClient()
    .from("playlist_admin")
    .select("admin_token")
    .eq("playlist_id", playlistId)
    .single();
  if (!row || row.admin_token !== archived.adminToken) throw new Error("권한이 없습니다.");
}
