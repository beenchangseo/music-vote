import { getCurrentUser } from "@/lib/auth";
import { isArchivedPlaylist } from "@/domain/playlist-archive";
import { createAdminClient } from "@/lib/supabase/server";
import { setlistMessage, type SetlistReason } from "@/lib/setlist-messages";

export type SetlistEditorDenial = Extract<SetlistReason, "playlist_not_found" | "archived" | "not_logged_in" | "not_editor" | "write_failed">;

/**
 * 셋리스트를 바꿀 수 있는지. 되면 null, 안 되면 그 이유.
 * 모두 편집하는 방에 처음 온 멤버는 여기서 참여자로 등록한다.
 */
export async function setlistEditorDenial(playlistId: string): Promise<SetlistEditorDenial | null> {
  const admin = createAdminClient();
  const { data: playlist } = await admin
    .from("playlists")
    .select("creator_user_id, setlist_edit_mode, default_vote_limit")
    .eq("id", playlistId)
    .single();

  if (!playlist) return "playlist_not_found";
  // 보관된 합주방은 셋리스트도 읽기 전용이다.
  if (isArchivedPlaylist(playlist)) return "archived";

  const user = await getCurrentUser();
  if (!user) return "not_logged_in";
  if (user.id === playlist.creator_user_id) return null;
  if (playlist.setlist_edit_mode === "host_only") return "not_editor";

  const { data: member } = await admin
    .from("playlist_members")
    .select("user_id")
    .eq("playlist_id", playlistId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    const { error } = await admin.from("playlist_members").insert({
      playlist_id: playlistId,
      user_id: user.id,
      display_name: user.nickname,
      vote_limit: playlist.default_vote_limit,
    });
    if (error) return "write_failed";
  }
  return null;
}

/** throw 하는 옛 모양의 셋리스트 액션이 쓴다. */
export async function assertSetlistEditor(playlistId: string): Promise<void> {
  const denial = await setlistEditorDenial(playlistId);
  if (denial) throw new Error(setlistMessage(denial));
}
