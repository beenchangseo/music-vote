"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SetlistItem } from "@/lib/types";

export async function getSetlistItems(playlistId: string): Promise<SetlistItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("setlist_items")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });
  return (data || []) as SetlistItem[];
}

export async function confirmSetlist(
  playlistId: string,
  adminToken: string,
  songIds: string[],
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

  // Transaction: update playlist + insert setlist items
  const { error: updateError } = await admin
    .from("playlists")
    .update({ setlist_confirmed: true })
    .eq("id", playlistId);

  if (updateError) throw new Error("셋리스트 확정에 실패했습니다.");

  const items = songIds.map((songId, i) => ({
    playlist_id: playlistId,
    position: i,
    item_type: "song" as const,
    song_id: songId,
    label: null,
    duration_seconds: 0,
  }));

  const { error: insertError } = await admin
    .from("setlist_items")
    .insert(items);

  if (insertError) {
    // Rollback: revert setlist_confirmed
    await admin.from("playlists").update({ setlist_confirmed: false }).eq("id", playlistId);
    throw new Error("셋리스트 항목 추가에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function addSetlistItem(
  playlistId: string,
  adminToken: string,
  item: { item_type: string; label: string; duration_seconds: number; position: number },
  shareCode: string
): Promise<SetlistItem> {
  const admin = createAdminClient();

  const { data: adminData } = await admin
    .from("playlist_admin")
    .select("admin_token")
    .eq("playlist_id", playlistId)
    .single();

  if (!adminData || adminData.admin_token !== adminToken) {
    throw new Error("권한이 없습니다.");
  }

  const { data, error } = await admin
    .from("setlist_items")
    .insert({
      playlist_id: playlistId,
      position: item.position,
      item_type: item.item_type,
      song_id: null,
      label: item.label,
      duration_seconds: item.duration_seconds,
    })
    .select()
    .single();

  if (error || !data) throw new Error("인터벌 블럭 추가에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function addSongToSetlist(
  playlistId: string,
  songId: string,
  shareCode: string
): Promise<SetlistItem> {
  const supabase = await createServerSupabaseClient();

  // Get current max position
  const { data: existing } = await supabase
    .from("setlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("setlist_items")
    .insert({
      playlist_id: playlistId,
      position: nextPosition,
      item_type: "song",
      song_id: songId,
      label: null,
      duration_seconds: 0,
    })
    .select()
    .single();

  if (error || !data) throw new Error("셋리스트 추가에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function updateSetlistOrder(
  playlistId: string,
  adminToken: string,
  itemIds: string[],
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

  // Bulk update positions
  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await admin
      .from("setlist_items")
      .update({ position: i })
      .eq("id", itemIds[i])
      .eq("playlist_id", playlistId);
    if (error) throw new Error("순서 변경에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function removeSetlistItem(
  playlistId: string,
  adminToken: string,
  itemId: string,
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
    .from("setlist_items")
    .delete()
    .eq("id", itemId)
    .eq("playlist_id", playlistId);

  if (error) throw new Error("항목 삭제에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
