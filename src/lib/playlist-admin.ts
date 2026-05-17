import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * 플리 관리 권한 검사. 통과하면 void, 아니면 throw.
 *
 * - 로그인 모드: creator_user_id === auth.uid() 면 토큰 무관 통과 (fast path)
 * - 익명 모드 (legacy): playlist_admin.admin_token 일치 시 통과
 */
export async function assertPlaylistAdmin(
  playlistId: string,
  adminToken: string | null,
): Promise<void> {
  const admin = createAdminClient();

  const { data: playlist } = await admin
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();

  if (playlist?.creator_user_id) {
    const user = await getCurrentUser();
    if (user && user.id === playlist.creator_user_id) return;
    // 로그인 모드인데 본인 아님 → 토큰 무시 (다른 사람이 토큰 알아내도 안 됨)
    throw new Error("권한이 없습니다.");
  }

  // 익명 모드 fallback
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
