"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { readSetlistItems } from "@/lib/playlist-reads";
import { playlistAdminDenial } from "@/lib/playlist-admin";
import { assertSetlistEditor, setlistEditorDenial } from "@/lib/setlist-permissions";
import { setlistMessage, setlistReasonFromDatabase, type SetlistReason } from "@/lib/setlist-messages";
import { revalidatePath } from "next/cache";
import { parseBlockFields, type NewSetlistBlock, type SetlistSlot } from "@/domain/setlist";
import type { ActionResult, SetlistItem } from "@/domain/types";

export interface BlockFieldsInput {
  label: string;
  description: string;
  duration_seconds: number;
}

/** 셋리 전체를 돌려주는 쓰기. items 는 쓰기 직후 서버의 셋리스트다. */
export type SetlistItemsResult = ActionResult<{ items: SetlistItem[] }, SetlistReason>;
/** items 가 null 이면 삭제는 닿았지만 그 뒤 셋리스트를 읽지 못한 것이다. 빈 셋리스트가 아니다. */
export type RemoveSetlistItemResult = ActionResult<{ items: SetlistItem[] | null }, SetlistReason>;
export type InsertSetlistBlockResult = ActionResult<{ itemId: string; items: SetlistItem[] }, SetlistReason>;

function cleanBlockFields(kind: "interval" | "original", item: BlockFieldsInput) {
  const clean = parseBlockFields(kind, { label: item.label, description: item.description, durationSeconds: item.duration_seconds });
  if (!clean) throw new Error(setlistMessage("invalid_block"));
  return clean;
}

/** v26·v27 함수가 돌려준 셋리스트. 모양이 다르면 null. */
function setlistFrom(data: unknown): SetlistItem[] | null {
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as SetlistItem[]) : null;
}

/**
 * 셋리스트를 확정하고 확정된 셋리를 돌려준다. 빈 셋리면 songIds 순서대로 채우고, 블록이 이미 있으면 지금 셋리 그대로
 * 확정한다. confirm_setlist(v27)가 넣기·순서 저장과 같은 잠금 안에서 한다.
 */
export async function confirmSetlist(playlistId: string, songIds: string[], shareCode: string): Promise<SetlistItemsResult> {
  const denial = await playlistAdminDenial(playlistId);
  if (denial) return { success: false, reason: denial };

  const { data, error } = await createAdminClient().rpc("confirm_setlist", {
    p_playlist_id: playlistId,
    p_song_ids: songIds,
  });
  if (error) {
    const reason = setlistReasonFromDatabase(error.message);
    if (reason === "write_failed") console.error("confirmSetlist", playlistId, error.code);
    return { success: false, reason };
  }
  const items = setlistFrom(data);
  if (!items) return { success: false, reason: "write_failed" };

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, items };
}

export async function updateIntervalItem(
  playlistId: string,
  itemId: string,
  item: BlockFieldsInput,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId);
  const clean = cleanBlockFields("interval", item);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("setlist_items")
    .update({
      label: clean.label,
      description: clean.description,
      duration_seconds: clean.durationSeconds,
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

export async function updateOriginalItem(
  playlistId: string,
  itemId: string,
  item: BlockFieldsInput,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId);
  const clean = cleanBlockFields("original", item);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("setlist_items")
    .update({
      label: clean.label,
      description: clean.description,
      duration_seconds: clean.durationSeconds,
    })
    .eq("id", itemId)
    .eq("playlist_id", playlistId)
    .eq("item_type", "original")
    .select("*")
    .single();
  if (error || !data) throw new Error("자작곡 수정에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return data as SetlistItem;
}

/**
 * 블록을 slot 자리에 넣는다. 뒤 블록을 미는 일과 동시에 넣는 다른 편집자와의 줄 세우기는 insert_setlist_item(v26)이
 * 한 트랜잭션 안에서 한다.
 */
export async function insertSetlistBlock(
  playlistId: string,
  slot: SetlistSlot,
  block: NewSetlistBlock,
  shareCode: string,
): Promise<InsertSetlistBlockResult> {
  const fields = block.kind === "song" ? null : parseBlockFields(block.kind, block);
  if (block.kind === "song" ? !block.songId : !fields) return { success: false, reason: "invalid_block" };

  const denial = await setlistEditorDenial(playlistId);
  if (denial) return { success: false, reason: denial };

  const { data, error } = await createAdminClient().rpc("insert_setlist_item", {
    p_playlist_id: playlistId,
    p_before_item_id: slot.before,
    p_item_type: block.kind,
    p_song_id: block.kind === "song" ? block.songId : null,
    p_label: fields?.label ?? null,
    p_description: fields?.description ?? null,
    p_duration_seconds: fields?.durationSeconds ?? 0,
  });
  if (error) {
    const reason = setlistReasonFromDatabase(error.message);
    if (reason === "write_failed") console.error("insertSetlistBlock", playlistId, error.code);
    return { success: false, reason };
  }
  const items = setlistFrom(data);
  const itemId = (data as { item_id?: unknown } | null)?.item_id;
  if (!items || typeof itemId !== "string") return { success: false, reason: "write_failed" };

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, itemId, items };
}

export async function updateSongSetlistItem(
  playlistId: string,
  itemId: string,
  title: string,
  durationSeconds: number,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId);
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
  itemId: string,
  shareCode: string,
): Promise<SetlistItem> {
  await assertSetlistEditor(playlistId);
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

/**
 * 셋리 전체 순서를 저장한다. reorder_setlist_items(v26)가 한 번에 쓰고, 화면이 모르는 블록(그 사이 다른 멤버가 넣은
 * 것)은 제자리에 둔다.
 */
export async function updateSetlistOrder(
  playlistId: string,
  itemIds: string[],
  shareCode: string,
): Promise<SetlistItemsResult> {
  const denial = await setlistEditorDenial(playlistId);
  if (denial) return { success: false, reason: denial };

  const { data, error } = await createAdminClient().rpc("reorder_setlist_items", {
    p_playlist_id: playlistId,
    p_item_ids: itemIds,
  });
  if (error) {
    const reason = setlistReasonFromDatabase(error.message);
    if (reason === "write_failed") console.error("updateSetlistOrder", playlistId, error.code);
    return { success: false, reason };
  }
  const items = setlistFrom(data);
  if (!items) return { success: false, reason: "write_failed" };

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, items };
}

export async function removeSetlistItem(
  playlistId: string,
  itemId: string,
  shareCode: string,
): Promise<RemoveSetlistItemResult> {
  const denial = await setlistEditorDenial(playlistId);
  if (denial) return { success: false, reason: denial };
  // No row count check: 0 rows means another editor removed it first, which is the end state asked for.
  const admin = createAdminClient();
  const { error } = await admin
    .from("setlist_items")
    .delete()
    .eq("id", itemId)
    .eq("playlist_id", playlistId);
  if (error) {
    console.error("removeSetlistItem", playlistId, error.code);
    return { success: false, reason: "write_failed" };
  }
  revalidatePath(`/playlist/${shareCode}`);
  // The delete landed even if this read fails. The read after every setlist write redraws the list.
  return { success: true, items: await readSetlistItems(admin, playlistId).catch(() => null) };
}
