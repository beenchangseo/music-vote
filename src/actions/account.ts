"use server";

/*
  계정 탈퇴. 로그인한 본인 계정만 지운다.

  카카오 연결 해제 → 밴드 넘기기 → 남는 행 정리 → 계정 삭제 → 이 기기 로그아웃 순서다. 내가 owner 인
  밴드는 가장 먼저 들어온 멤버에게 넘긴다(team_members.role). 남는 행(외래 키가 SET NULL 인 곡·다른
  버전·플레이리스트)은 계정을 지우기 전에 정리한다. 지운 뒤에는 user id 가 NULL 이 되어 어느 행이 그
  사람 것인지 찾을 수 없고, 내 team_members 행도 CASCADE 로 사라져 어느 밴드를 맡았는지 알 수 없다.

  어느 단계에서 멈춰도 다시 부르면 같은 끝 상태로 간다. 이미 끊긴 카카오 연결과 이미 지운 계정은
  성공으로 본다. 계정이 지워진 뒤 다시 부르면 로그인 검사에서 not_logged_in 으로 끝난다.
*/

import { revalidatePath } from "next/cache";
import { bandOwnerAfterLeaving, type BandSuccession } from "@/domain/team";
import { getCurrentUser } from "@/lib/auth";
import { unlinkKakaoUser } from "@/lib/kakao-unlink";
import { nestedRows } from "@/lib/supabase/nested";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult, TeamRole } from "@/domain/types";

export type DeleteAccountResult = ActionResult<
  Record<never, never>,
  "not_logged_in" | "not_available" | "kakao_unlink_failed" | "write_failed"
>;

/** 탈퇴 확인창에 적을 "'밴드' 밴드는 ○○님이 리더를 맡아요" 목록. 계정 id 는 내려보내지 않는다(ADR 0011). */
export type AccountDeletionPreview = ActionResult<
  { handovers: { bandName: string; ownerName: string }[] },
  "not_logged_in" | "read_failed"
>;

const LEFT_MEMBER_NAME = "탈퇴한 멤버";

const NAME_COLUMNS_ON_KEPT_ROWS = [
  { table: "songs", name: "added_by", owner: "added_by_user_id" },
  { table: "song_versions", name: "added_by_nickname", owner: "added_by_user_id" },
  { table: "playlists", name: "creator_nickname", owner: "creator_user_id" },
] as const;

type Admin = ReturnType<typeof createAdminClient>;
type BandMember = { user_id: string; display_name: string; role: TeamRole; joined_at: string };
type OwnedBand = { teamId: string; name: string; succession: BandSuccession<BandMember> };

/** 내가 owner 인 밴드와, 내가 떠난 뒤 누가 맡는지. 조회가 실패하면 null. */
async function readOwnedBands(admin: Admin, userId: string): Promise<OwnedBand[] | null> {
  const { data, error } = await admin
    .from("team_members")
    .select("team_id, teams(name, team_members(user_id, display_name, role, joined_at))")
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) {
    console.error("account: owned bands lookup failed", userId, error.message);
    return null;
  }
  type TeamRow = { name: string; team_members: BandMember[] | null };
  return ((data ?? []) as { team_id: string; teams: TeamRow | TeamRow[] | null }[]).flatMap((row) =>
    nestedRows(row.teams).map((team) => ({
      teamId: row.team_id,
      name: team.name,
      succession: bandOwnerAfterLeaving(team.team_members ?? [], userId),
    })),
  );
}

export async function previewAccountDeletion(): Promise<AccountDeletionPreview> {
  const user = await getCurrentUser();
  if (!user) return { success: false, reason: "not_logged_in" };

  const bands = await readOwnedBands(createAdminClient(), user.id);
  if (!bands) return { success: false, reason: "read_failed" };
  return {
    success: true,
    handovers: bands.flatMap(({ name, succession }) =>
      succession.kind === "empty" ? [] : [{ bandName: name, ownerName: succession.owner.display_name }],
    ),
  };
}

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
    if (unlink.kind === "not_configured") {
      console.error("deleteAccount: KAKAO_ADMIN_KEY is not set", user.id);
      return { success: false, reason: "not_available" };
    }
    if (unlink.kind === "failed") {
      console.error(
        `deleteAccount: kakao unlink failed (http ${unlink.httpStatus ?? "none"}, code ${unlink.kakaoCode ?? "none"})`,
        user.id,
      );
      return { success: false, reason: "kakao_unlink_failed" };
    }
    // Tells a real unlink (no line) apart from Kakao saying the link was already gone.
    if (unlink.kind === "already_unlinked") {
      console.info(`deleteAccount: kakao already unlinked (code ${unlink.kakaoCode})`, user.id);
    }
  }

  // Before the account goes: deleting it cascades my team_members rows, and then nothing says
  // which bands I owned. A retry finds a band already handed over as "kept" and skips it.
  const bands = await readOwnedBands(admin, user.id);
  if (!bands) return { success: false, reason: "write_failed" };
  for (const { teamId, succession } of bands) {
    if (succession.kind !== "promote") continue;
    const { data, error } = await admin
      .from("team_members")
      .update({ role: "owner" })
      .eq("team_id", teamId)
      .eq("user_id", succession.owner.user_id)
      .select("user_id");
    // 0 rows: the member left the band in between. A retry picks the next one.
    if (error || data?.length !== 1) {
      console.error("deleteAccount: band handover failed", user.id, teamId, error?.message ?? "0 rows");
      return { success: false, reason: "write_failed" };
    }
    revalidatePath(`/band/${teamId}`);
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

  // The account is gone either way. A failed sign-out only leaves a cookie for a user that no longer
  // exists, which getUser rejects on the next request, so it must not read as a failed deletion.
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.error("deleteAccount: sign-out after delete failed", user.id, error instanceof Error ? error.message : "");
  }
  return { success: true };
}
