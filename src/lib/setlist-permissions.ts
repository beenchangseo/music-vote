import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistAdmin } from "@/lib/playlist-admin";
import { createAdminClient } from "@/lib/supabase/server";

export async function assertSetlistEditor(
  playlistId: string,
  adminToken: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { data: playlist } = await admin
    .from("playlists")
    .select("creator_user_id, setlist_edit_mode, default_vote_limit")
    .eq("id", playlistId)
    .single();

  if (!playlist) throw new Error("합주방을 찾을 수 없습니다.");

  if (playlist.setlist_edit_mode === "host_only") {
    await assertPlaylistAdmin(playlistId, adminToken);
    return;
  }

  // 옛 익명 합주방은 기존의 링크 기반 공동 편집을 유지한다.
  if (!playlist.creator_user_id) return;

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  if (user.id === playlist.creator_user_id) return;

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
    if (error) throw new Error("합주방 참여자 등록에 실패했습니다.");
  }
}
