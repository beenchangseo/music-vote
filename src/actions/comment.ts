"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistWritableBySong } from "@/lib/playlist-access";
import { COMMENT_COLUMNS, commentsForViewer } from "@/lib/playlist-reads";
import { revalidatePath } from "next/cache";
import type { Comment } from "@/domain/types";

export async function getCommentsBySong(songId: string): Promise<Comment[]> {
  const admin = createAdminClient();
  const [{ data }, viewer] = await Promise.all([
    admin.from("comments").select(COMMENT_COLUMNS).eq("song_id", songId).order("created_at", { ascending: true }),
    getCurrentUser(),
  ]);
  return commentsForViewer(data || [], viewer?.id ?? null);
}

export async function addOrUpdateComment(
  songId: string,
  content: string,
  shareCode: string
) {
  if (!content.trim()) throw new Error("댓글 내용을 입력해주세요.");
  if (content.length > 1000) throw new Error("댓글은 1000자 이내여야 합니다.");

  await assertPlaylistWritableBySong(songId);

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  /*
    v18 closes SELECT on comments to the public key, and Postgres applies SELECT
    policies to the WHERE of UPDATE/DELETE. A session-client lookup would then
    always miss, turning every edit into an insert that hits uq_comments_song_user.
    Lookup and update go through service_role, pinned to the session user's id.
  */
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("comments")
    .select("id")
    .eq("song_id", songId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await admin
      .from("comments")
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("id");
    // 0 rows must not pass as success.
    if (error || !updated || updated.length === 0) throw new Error("댓글 수정에 실패했습니다.");
  } else {
    // Insert stays on the session client: comments_insert checks auth.uid() = user_id
    // and no RETURNING is requested, so it needs no SELECT.
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("comments")
      .insert({
        song_id: songId,
        user_id: user.id,
        nickname: user.nickname,
        content: content.trim(),
      });
    if (error) throw new Error("댓글 작성에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function deleteComment(songId: string, shareCode: string) {
  await assertPlaylistWritableBySong(songId);

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  // Same reason as addOrUpdateComment: a session DELETE would silently match 0 rows after v18.
  const admin = createAdminClient();
  const { data: deleted, error } = await admin
    .from("comments")
    .delete()
    .eq("song_id", songId)
    .eq("user_id", user.id)
    .select("id");

  if (error || !deleted || deleted.length === 0) throw new Error("댓글 삭제에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
