"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylistModeBySong } from "@/lib/playlist-mode";
import { revalidatePath } from "next/cache";
import type { Comment } from "@/lib/types";

export async function getComments(playlistId: string): Promise<Comment[]> {
  const supabase = await createServerSupabaseClient();

  // Get all song IDs for this playlist
  const { data: songs } = await supabase
    .from("songs")
    .select("id")
    .eq("playlist_id", playlistId);

  if (!songs || songs.length === 0) return [];

  const songIds = songs.map((s: { id: string }) => s.id);
  const { data } = await supabase
    .from("comments")
    .select("*")
    .in("song_id", songIds)
    .order("created_at", { ascending: true });

  return (data || []) as Comment[];
}

export async function getCommentsBySong(songId: string): Promise<Comment[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("song_id", songId)
    .order("created_at", { ascending: true });
  return (data || []) as Comment[];
}

export async function addOrUpdateComment(
  songId: string,
  nickname: string,
  content: string,
  shareCode: string
) {
  if (!content.trim()) throw new Error("댓글 내용을 입력해주세요.");
  if (content.length > 1000) throw new Error("댓글은 1000자 이내여야 합니다.");

  const supabase = await createServerSupabaseClient();
  const { requiresLogin } = await getPlaylistModeBySong(songId);

  if (requiresLogin) {
    const user = await getCurrentUser();
    if (!user) throw new Error("로그인이 필요합니다.");

    const { data: existing } = await supabase
      .from("comments")
      .select("id")
      .eq("song_id", songId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("comments")
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error("댓글 수정에 실패했습니다.");
    } else {
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

  // Anonymous mode
  if (!nickname.trim()) throw new Error("닉네임이 필요합니다.");

  const { data: existing } = await supabase
    .from("comments")
    .select("id")
    .eq("song_id", songId)
    .eq("nickname", nickname)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("comments")
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error("댓글 수정에 실패했습니다.");
  } else {
    const { error } = await supabase
      .from("comments")
      .insert({ song_id: songId, nickname: nickname.trim(), content: content.trim() });
    if (error) throw new Error("댓글 작성에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function deleteComment(
  songId: string,
  nickname: string,
  shareCode: string
) {
  const supabase = await createServerSupabaseClient();
  const { requiresLogin } = await getPlaylistModeBySong(songId);

  if (requiresLogin) {
    const user = await getCurrentUser();
    if (!user) throw new Error("로그인이 필요합니다.");

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("song_id", songId)
      .eq("user_id", user.id);

    if (error) throw new Error("댓글 삭제에 실패했습니다.");

    revalidatePath(`/playlist/${shareCode}`);
    return { success: true };
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("song_id", songId)
    .eq("nickname", nickname);

  if (error) throw new Error("댓글 삭제에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
