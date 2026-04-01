"use server";

import { nanoid } from "nanoid";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPlaylist(title: string, deadline?: string, setlistCount?: number, creatorNickname?: string) {
  if (!title || title.length > 100) {
    throw new Error("플레이리스트 제목은 1~100자여야 합니다.");
  }

  const supabase = await createServerSupabaseClient();
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
        creator_nickname: creatorNickname || null,
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
  adminToken: string,
  announcement: string,
  shareCode: string
) {
  const admin = createAdminClient();

  const { data: adminData } = await admin
    .from("playlist_admin")
    .select("admin_token")
    .eq("playlist_id", playlistId)
    .single();

  if (!adminData || adminData.admin_token !== adminToken) {
    throw new Error("권한이 없습니다.");
  }

  const { error } = await admin
    .from("playlists")
    .update({ announcement: announcement || null })
    .eq("id", playlistId);

  if (error) throw new Error("공지사항 저장에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function deletePlaylist(playlistId: string, adminToken: string) {
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
    .from("playlists")
    .delete()
    .eq("id", playlistId);

  if (error) throw new Error("플레이리스트 삭제에 실패했습니다.");

  revalidatePath("/");
  return { success: true };
}
