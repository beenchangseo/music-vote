"use server";

import { nanoid } from "nanoid";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistAdmin } from "@/lib/playlist-admin";
import { revalidatePath } from "next/cache";

export interface MyPlaylistDbEntry {
  id: string;
  shareCode: string;
  title: string;
}

/**
 * 로그인 사용자의 플리 목록 (creator_user_id = auth.uid()).
 * 비로그인 시 빈 배열.
 */
export async function getMyPlaylists(): Promise<MyPlaylistDbEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("playlists")
    .select("id, share_code, title, created_at")
    .eq("creator_user_id", user.id)
    .order("created_at", { ascending: false });
  return (data || []).map((p) => ({
    id: p.id,
    shareCode: p.share_code,
    title: p.title,
  }));
}

export async function createPlaylist(title: string, deadline?: string, setlistCount?: number) {
  if (!title || title.length > 100) {
    throw new Error("플레이리스트 제목은 1~100자여야 합니다.");
  }

  const supabase = await createServerSupabaseClient();
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  const admin = createAdminClient();

  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    const shareCode = nanoid(8);
    const adminToken = nanoid(16);

    const { data, error } = await supabase
      .from("playlists")
      .insert({
        title,
        share_code: shareCode,
        deadline: deadline || null,
        setlist_count: setlistCount && setlistCount > 0 ? setlistCount : null,
        creator_nickname: user.nickname,
        creator_user_id: user.id,
      })
      .select("id, share_code")
      .single();

    if (error?.code === "23505") continue; // unique violation, retry
    if (error) throw new Error("플레이리스트 생성에 실패했습니다.");

    // Store admin token in separate table (service role only)
    const { error: adminError } = await admin.from("playlist_admin").insert({
      playlist_id: data.id,
      admin_token: adminToken,
    });

    if (adminError) {
      // Rollback: delete the playlist since admin token failed
      await admin.from("playlists").delete().eq("id", data.id);
      throw new Error("플레이리스트 생성에 실패했습니다.");
    }

    return { id: data.id, shareCode: data.share_code, adminToken };
  }

  throw new Error("share_code 생성에 실패했습니다. 다시 시도해주세요.");
}

export async function updateCreatorNickname(
  playlistId: string,
  creatorNickname: string,
  shareCode: string
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("playlists")
    .update({ creator_nickname: creatorNickname })
    .eq("id", playlistId);
  if (error) throw new Error("닉네임 저장에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateAnnouncementPublic(
  playlistId: string,
  announcement: string,
  shareCode: string
) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("playlists")
    .update({ announcement: announcement || null })
    .eq("id", playlistId);

  if (error) throw new Error("공지사항 저장에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateAnnouncement(
  playlistId: string,
  adminToken: string | null,
  announcement: string,
  shareCode: string
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .update({ announcement: announcement || null })
    .eq("id", playlistId);

  if (error) throw new Error("공지사항 저장에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateVotingMode(
  playlistId: string,
  adminToken: string | null,
  votesAnonymous: boolean,
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .update({ votes_anonymous: votesAnonymous })
    .eq("id", playlistId);

  if (error) throw new Error("투표 모드 변경에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

// ============================================================
// 공연 포스터 (Supabase Storage: setlist-posters 버킷)
// ============================================================

const POSTER_BUCKET = "setlist-posters";
const MAX_POSTER_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadSetlistPoster(
  playlistId: string,
  adminToken: string | null,
  formData: FormData,
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);

  const file = formData.get("poster");
  if (!(file instanceof File)) throw new Error("파일이 없습니다.");
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있어요.");
  }
  if (file.size > MAX_POSTER_BYTES) {
    throw new Error("파일이 너무 큽니다 (5MB 이하).");
  }

  const admin = createAdminClient();

  // Path: {playlistId}/{timestamp}.{ext} — 이전 파일은 별도 정리 단계로 삭제
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${playlistId}/${Date.now()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(POSTER_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });
  if (upErr) throw new Error("업로드에 실패했습니다.");

  const { data: pub } = admin.storage.from(POSTER_BUCKET).getPublicUrl(path);
  const posterUrl = pub.publicUrl;

  // 이전 포스터 경로 정리
  const { data: prev } = await admin
    .from("playlists")
    .select("poster_url")
    .eq("id", playlistId)
    .single();

  const { error: dbErr } = await admin
    .from("playlists")
    .update({ poster_url: posterUrl })
    .eq("id", playlistId);
  if (dbErr) throw new Error("저장에 실패했습니다.");

  if (prev?.poster_url) {
    const prevPath = extractPosterPath(prev.poster_url);
    if (prevPath && prevPath !== path) {
      await admin.storage.from(POSTER_BUCKET).remove([prevPath]).catch(() => {});
    }
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, posterUrl };
}

export async function removeSetlistPoster(
  playlistId: string,
  adminToken: string | null,
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();

  const { data: prev } = await admin
    .from("playlists")
    .select("poster_url")
    .eq("id", playlistId)
    .single();

  const { error: dbErr } = await admin
    .from("playlists")
    .update({ poster_url: null })
    .eq("id", playlistId);
  if (dbErr) throw new Error("저장에 실패했습니다.");

  if (prev?.poster_url) {
    const prevPath = extractPosterPath(prev.poster_url);
    if (prevPath) {
      await admin.storage.from(POSTER_BUCKET).remove([prevPath]).catch(() => {});
    }
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

function extractPosterPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${POSTER_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}

export async function deletePlaylist(playlistId: string, adminToken: string | null) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .delete()
    .eq("id", playlistId);

  if (error) throw new Error("플레이리스트 삭제에 실패했습니다.");

  revalidatePath("/");
  return { success: true };
}
