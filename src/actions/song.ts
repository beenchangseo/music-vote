"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylistModeById } from "@/lib/playlist-mode";
import { extractVideoId, fetchVideoMetadata } from "@/lib/youtube";
import {
  isValidKeyRoot,
  isValidKeyMode,
  isValidGenre,
  isValidDifficulty,
} from "@/lib/song-meta";
import type { KeyRoot, KeyMode, Genre, Difficulty } from "@/lib/types";
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
  const { requiresLogin } = await getPlaylistModeById(playlistId);

  let addedByUserId: string | null = null;
  let resolvedAddedBy: string | null = addedBy || null;
  if (requiresLogin) {
    const user = await getCurrentUser();
    if (!user) throw new Error("로그인이 필요합니다.");
    addedByUserId = user.id;
    resolvedAddedBy = user.nickname;
  }

  const { error } = await supabase.from("songs").insert({
    playlist_id: playlistId,
    title,
    artist,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    thumbnail_url: thumbnailUrl,
    added_by: resolvedAddedBy,
    added_by_user_id: addedByUserId,
  });

  if (error) throw new Error("곡 추가에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, needsManualTitle: !metadata && !manualTitle };
}

export interface SongMetaUpdate {
  keyMemo?: string | null;
  tempoBpm?: number | null;
  durationSeconds?: number | null;
  keyRoot?: KeyRoot | null;
  keyMode?: KeyMode | null;
  difficulty?: Difficulty | null;
  genre?: Genre | null;
}

export async function updateSongMeta(
  songId: string,
  playlistId: string,
  shareCode: string,
  data: SongMetaUpdate,
) {
  const supabase = await createServerSupabaseClient();

  // Verify song belongs to playlist
  const { data: song } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("playlist_id", playlistId)
    .single();

  if (!song) throw new Error("곡을 찾을 수 없습니다.");

  const updateData: Record<string, unknown> = {};

  if (data.keyMemo !== undefined) {
    updateData.key_memo = data.keyMemo;
  }
  if (data.tempoBpm !== undefined) {
    const bpm = data.tempoBpm;
    updateData.tempo_bpm =
      bpm == null ? null : bpm >= 40 && bpm <= 300 ? bpm : null;
  }
  if (data.durationSeconds !== undefined) {
    updateData.duration_seconds = data.durationSeconds;
  }
  if (data.keyRoot !== undefined) {
    updateData.key_root =
      data.keyRoot == null ? null : isValidKeyRoot(data.keyRoot) ? data.keyRoot : null;
  }
  if (data.keyMode !== undefined) {
    updateData.key_mode =
      data.keyMode == null ? null : isValidKeyMode(data.keyMode) ? data.keyMode : null;
  }
  if (data.difficulty !== undefined) {
    updateData.difficulty =
      data.difficulty == null ? null : isValidDifficulty(data.difficulty) ? data.difficulty : null;
  }
  if (data.genre !== undefined) {
    updateData.genre =
      data.genre == null ? null : isValidGenre(data.genre) ? data.genre : null;
  }

  if (Object.keys(updateData).length === 0) return { success: true };

  const { error } = await supabase
    .from("songs")
    .update(updateData)
    .eq("id", songId);

  if (error) throw new Error("곡 정보 업데이트에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
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
