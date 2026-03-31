"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { extractVideoId, fetchVideoMetadata } from "@/lib/youtube";
import { revalidatePath } from "next/cache";

export async function addSong(
  playlistId: string,
  youtubeUrl: string,
  shareCode: string,
  addedBy?: string,
  manualTitle?: string
) {
  if (!youtubeUrl || youtubeUrl.length > 500) {
    throw new Error("올바른 YouTube URL을 입력해주세요.");
  }

  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("올바른 YouTube URL을 입력해주세요.");
  }

  const metadata = manualTitle ? null : await fetchVideoMetadata(videoId);

  const title = metadata?.title || manualTitle || youtubeUrl;
  const artist = metadata?.author_name || null;
  const thumbnailUrl = metadata?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("songs").insert({
    playlist_id: playlistId,
    title,
    artist,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    thumbnail_url: thumbnailUrl,
    added_by: addedBy || null,
  });

  if (error) throw new Error("곡 추가에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, needsManualTitle: !metadata && !manualTitle };
}

export async function removeSong(
  songId: string,
  playlistId: string,
  adminToken: string,
  shareCode: string
) {
  const admin = createAdminClient();

  const { data: adminData } = await admin
    .from("playlist_admin")
    .select("admin_token")
    .eq("playlist_id", playlistId)
    .single();

  if (!adminData || adminData.admin_token !== adminToken) {
    throw new Error("삭제 권한이 없습니다.");
  }

  const { error } = await admin
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("playlist_id", playlistId);
  if (error) throw new Error("곡 삭제에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
