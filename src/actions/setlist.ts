"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPlaylistAdmin } from "@/lib/playlist-admin";
import { assertSetlistEditor } from "@/lib/setlist-permissions";
import { revalidatePath } from "next/cache";
import type { SetlistItem } from "@/lib/types";

export interface IntervalInput {
  label: string;
  description: string;
  duration_seconds: number;
  position: number;
}

function validateInterval(item: IntervalInput) {
  const label = item.label.trim();
  const description = item.description.trim();
  if (!label || label.length > 50) {
    throw new Error("블록 이름은 1~50자여야 합니다.");
  }
  if (description.length > 200) {
    throw new Error("설명은 200자 이내여야 합니다.");
  }
  if (!Number.isInteger(item.duration_seconds) || item.duration_seconds < 0) {
    throw new Error("시간은 0 이상의 정수여야 합니다.");
  }
  return { label, description: description || null };
}

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
  adminToken: string | null,
  songIds: string[],
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
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
    description: null,
    duration_seconds: 0,
    title_override: null,
    duration_override_seconds: null,
  }));
  const { error: insertError } = await admin.from("setlist_items").insert(items);
  if (insertError) {
    await admin.from("playlists").update({ setlist_confirmed: false }).eq("id", playlistId);
    throw new Error("셋리스트 항목 추가에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function addIntervalItem(
  playlistId: string,
  adminToken: string | null,
  item: IntervalInput,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId, adminToken);
  const clean = validateInterval(item);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("setlist_items")
    .insert({
      playlist_id: playlistId,
      position: item.position,
      item_type: "interval",
      song_id: null,
      label: clean.label,
      description: clean.description,
      duration_seconds: item.duration_seconds,
      title_override: null,
      duration_override_seconds: null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("인터벌 블록 추가에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function updateIntervalItem(
  playlistId: string,
  adminToken: string | null,
  itemId: string,
  item: Omit<IntervalInput, "position">,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId, adminToken);
  const clean = validateInterval({ ...item, position: 0 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("setlist_items")
    .update({
      label: clean.label,
      description: clean.description,
      duration_seconds: item.duration_seconds,
    })
    .eq("id", itemId)
    .eq("playlist_id", playlistId)
    .eq("item_type", "interval")
    .select("*")
    .single();
  if (error || !data) throw new Error("인터벌 블록 수정에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function addSongToSetlist(
  playlistId: string,
  adminToken: string | null,
  songId: string,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId, adminToken);
  const admin = createAdminClient();
  const { data: song } = await admin
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("playlist_id", playlistId)
    .single();
  if (!song) throw new Error("곡을 찾을 수 없습니다.");

  const { data: existing } = await admin
    .from("setlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data, error } = await admin
    .from("setlist_items")
    .insert({
      playlist_id: playlistId,
      position: nextPosition,
      item_type: "song",
      song_id: songId,
      label: null,
      description: null,
      duration_seconds: 0,
      title_override: null,
      duration_override_seconds: null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("셋리스트 추가에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function updateSongSetlistItem(
  playlistId: string,
  adminToken: string | null,
  itemId: string,
  title: string,
  durationSeconds: number,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId, adminToken);
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 200) {
    throw new Error("곡 제목은 1~200자여야 합니다.");
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0) {
    throw new Error("시간은 0 이상의 정수여야 합니다.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("setlist_items")
    .update({
      title_override: cleanTitle,
      duration_override_seconds: durationSeconds,
    })
    .eq("id", itemId)
    .eq("playlist_id", playlistId)
    .eq("item_type", "song")
    .select("*")
    .single();
  if (error || !data) throw new Error("곡 블록 수정에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function resetSongSetlistItem(
  playlistId: string,
  adminToken: string | null,
  itemId: string,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId, adminToken);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("setlist_items")
    .update({ title_override: null, duration_override_seconds: null })
    .eq("id", itemId)
    .eq("playlist_id", playlistId)
    .eq("item_type", "song")
    .select("*")
    .single();
  if (error || !data) throw new Error("곡 블록 초기화에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

export async function updateSetlistOrder(
  playlistId: string,
  adminToken: string | null,
  itemIds: string[],
  shareCode: string,
) {
  await assertSetlistEditor(playlistId, adminToken);
  const admin = createAdminClient();
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
  adminToken: string | null,
  itemId: string,
  shareCode: string,
) {
  await assertSetlistEditor(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("setlist_items")
    .delete()
    .eq("id", itemId)
    .eq("playlist_id", playlistId);
  if (error) throw new Error("항목 삭제에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
