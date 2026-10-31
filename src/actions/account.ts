"use server";

/*
  계정 탈퇴. 로그인한 본인 계정만 지운다.

  카카오 연결 해제 → 남는 행 정리 → 계정 삭제 → 이 기기 로그아웃 순서다. 남는 행(외래 키가
  SET NULL 인 곡·다른 버전·플레이리스트)은 계정을 지우기 전에 정리한다. 지운 뒤에는 user id 가
  NULL 이 되어 어느 행이 그 사람 것인지 찾을 수 없다.

  어느 단계에서 멈춰도 다시 부르면 같은 끝 상태로 간다. 이미 끊긴 카카오 연결과 이미 지운 계정은
  성공으로 본다. 계정이 지워진 뒤 다시 부르면 로그인 검사에서 not_logged_in 으로 끝난다.
*/

import { getCurrentUser } from "@/lib/auth";
import { unlinkKakaoUser } from "@/lib/kakao-unlink";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/domain/types";

export type DeleteAccountResult = ActionResult<
  Record<never, never>,
  "not_logged_in" | "kakao_unlink_failed" | "write_failed"
>;

const LEFT_MEMBER_NAME = "탈퇴한 멤버";

const NAME_COLUMNS_ON_KEPT_ROWS = [
  { table: "songs", name: "added_by", owner: "added_by_user_id" },
  { table: "song_versions", name: "added_by_nickname", owner: "added_by_user_id" },
  { table: "playlists", name: "creator_nickname", owner: "creator_user_id" },
] as const;

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, reason: "not_logged_in" };

  const admin = createAdminClient();

  // The Kakao id comes from the identity row. user_metadata is editable by the user, so a
  // forged provider_id there could unlink someone else's Kakao account.
  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(user.id);
  if (lookupError) {
    console.error("deleteAccount: user lookup failed", user.id, lookupError.message);
    return { success: false, reason: "write_failed" };
  }
  const kakaoId = found.user.identities?.find((identity) => identity.provider === "kakao")?.id;
  if (kakaoId) {
    const unlink = await unlinkKakaoUser(kakaoId);
    if (unlink !== "unlinked") {
      console.error(`deleteAccount: kakao unlink ${unlink}`, user.id);
      return { success: false, reason: "kakao_unlink_failed" };
    }
  }

  const { data: hosted, error: hostedError } = await admin
    .from("playlists")
    .select("id")
    .eq("creator_user_id", user.id);
  if (hostedError) {
    console.error("deleteAccount: hosted playlists lookup failed", user.id, hostedError.message);
    return { success: false, reason: "write_failed" };
  }
  const hostedIds = (hosted ?? []).map((row: { id: string }) => row.id);

  // service_role skips RLS, so a write that matches 0 rows only means the member left nothing there.
  const cleanup = await Promise.all([
    ...NAME_COLUMNS_ON_KEPT_ROWS.map(({ table, name, owner }) =>
      admin.from(table).update({ [name]: LEFT_MEMBER_NAME }).eq(owner, user.id),
    ),
    // A hostless playlist accepts the admin token as its only delete right (docs/adr/0012). The
    // leaving host's browser still holds that token, so drop it.
    ...(hostedIds.length > 0 ? [admin.from("playlist_admin").delete().in("playlist_id", hostedIds)] : []),
  ]);
  const cleanupError = cleanup.find((result) => result.error)?.error;
  if (cleanupError) {
    console.error("deleteAccount: cleanup failed", user.id, cleanupError.message);
    return { success: false, reason: "write_failed" };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError && deleteError.status !== 404) {
    console.error("deleteAccount: delete failed", user.id, deleteError.message);
    return { success: false, reason: "write_failed" };
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  return { success: true };
}
