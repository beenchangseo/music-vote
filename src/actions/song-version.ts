"use server";

import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistWritableBySong } from "@/lib/playlist-access";
import { createAdminClient } from "@/lib/supabase/server";
import { extractVideoId, fetchVideoMetadata } from "@/lib/youtube";
import { ARCHIVED_PLAYLIST_MESSAGE, isArchivedPlaylist } from "@/domain/playlist-archive";
import type { SongVersion } from "@/domain/types";
import { revalidatePath } from "next/cache";

type DuplicateKind = "original" | "version";

type SaveResult =
  | { success: true; version: SongVersion }
  | { success: false; needsConfirmation: true; duplicateKind: DuplicateKind };

function validateDescription(description: string): string | null {
  const trimmed = description.trim();
  if (trimmed.length > 100) throw new Error("설명은 100자 이내여야 합니다.");
  return trimmed || null;
}

async function getSongVideoId(songId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("songs")
    .select("youtube_video_id")
    .eq("id", songId)
    .single<{ youtube_video_id: string }>();
  if (!data) throw new Error("곡을 찾을 수 없습니다.");
  return data.youtube_video_id;
}

async function duplicateKind(
  songId: string,
  videoId: string,
  originalVideoId: string,
  excludeVersionId?: string,
): Promise<DuplicateKind | null> {
  if (videoId === originalVideoId) return "original";
  const admin = createAdminClient();
  let query = admin
    .from("song_versions")
    .select("id")
    .eq("song_id", songId)
    .eq("youtube_video_id", videoId);
  if (excludeVersionId) query = query.neq("id", excludeVersionId);
  const { data } = await query.limit(1);
  return data && data.length > 0 ? "version" : null;
}

export async function getSongVersions(songId: string): Promise<SongVersion[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("song_versions")
    .select("*")
    .eq("song_id", songId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("다른 버전을 불러오지 못했습니다.");
  return (data || []) as SongVersion[];
}

export async function addSongVersion(
  songId: string,
  youtubeUrl: string,
  description: string,
  shareCode: string,
  force = false,
): Promise<SaveResult> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("올바른 YouTube 링크를 입력해주세요.");
  const cleanDescription = validateDescription(description);
  await assertPlaylistWritableBySong(songId);
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const duplicate = await duplicateKind(songId, videoId, await getSongVideoId(songId));
  if (duplicate && !force) {
    return { success: false, needsConfirmation: true, duplicateKind: duplicate };
  }

  const metadata = await fetchVideoMetadata(videoId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("song_versions")
    .insert({
      song_id: songId,
      youtube_url: youtubeUrl,
      youtube_video_id: videoId,
      title: metadata?.title || youtubeUrl,
      thumbnail_url: metadata?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      description: cleanDescription,
      added_by_user_id: user.id,
      added_by_nickname: user.nickname,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("다른 버전 추가에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, version: data as SongVersion };
}

async function assertVersionManager(versionId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("song_versions")
    .select("id, song_id, added_by_user_id, songs!inner(youtube_video_id, playlists!inner(creator_user_id))")
    .eq("id", versionId)
    .single<{
      id: string;
      song_id: string;
      added_by_user_id: string | null;
      songs: {
        youtube_video_id: string;
        playlists: { creator_user_id: string | null };
      };
    }>();
  if (!data) throw new Error("다른 버전을 찾을 수 없습니다.");

  if (isArchivedPlaylist(data.songs.playlists)) throw new Error(ARCHIVED_PLAYLIST_MESSAGE);
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  if (user.id !== data.songs.playlists.creator_user_id && user.id !== data.added_by_user_id) {
    throw new Error("이 링크를 수정할 권한이 없습니다.");
  }

  return data;
}

export async function updateSongVersion(
  versionId: string,
  youtubeUrl: string,
  description: string,
  shareCode: string,
  force = false,
): Promise<SaveResult> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("올바른 YouTube 링크를 입력해주세요.");
  const cleanDescription = validateDescription(description);
  const current = await assertVersionManager(versionId);

  const duplicate = await duplicateKind(
    current.song_id,
    videoId,
    current.songs.youtube_video_id,
    versionId,
  );
  if (duplicate && !force) {
    return { success: false, needsConfirmation: true, duplicateKind: duplicate };
  }

  const metadata = await fetchVideoMetadata(videoId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("song_versions")
    .update({
      youtube_url: youtubeUrl,
      youtube_video_id: videoId,
      title: metadata?.title || youtubeUrl,
      thumbnail_url: metadata?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      description: cleanDescription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .select("*")
    .single();
  if (error || !data) throw new Error("다른 버전 수정에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, version: data as SongVersion };
}

export async function deleteSongVersion(versionId: string, shareCode: string) {
  await assertVersionManager(versionId);
  const admin = createAdminClient();
  const { error } = await admin.from("song_versions").delete().eq("id", versionId);
  if (error) throw new Error("다른 버전 삭제에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
