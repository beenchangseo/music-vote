"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import AddIntervalForm from "./AddIntervalForm";
import IntervalBlock from "./IntervalBlock";
import SetlistItemEditModal from "./SetlistItemEditModal";
import SetlistShareButton from "./SetlistShareButton";
import { useDialog } from "./DialogProvider";
import { removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import { updateSetlistEditMode } from "@/actions/playlist";
import { effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, summarizeSetlist } from "@/lib/setlist-domain";
import type { SetlistEditMode, SetlistItem, SongWithScore } from "@/lib/types";

interface Props {
  setlistItems: SetlistItem[];
  songs: SongWithScore[];
  playlistId: string;
  shareCode: string;
  isAdmin: boolean;
  adminToken: string | null;
  loading: boolean;
  onItemsChange: (items: SetlistItem[]) => void;
  title: string;
  editMode: SetlistEditMode;
  canEdit: boolean;
  onEditModeChange: (mode: SetlistEditMode) => void;
}

export default function SetlistView({ setlistItems, songs, playlistId, shareCode, isAdmin, adminToken, loading, onItemsChange, title, editMode, canEdit, onEditModeChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<SetlistItem | null>(null);
  const { showDanger, showAlert } = useDialog();

  const songMap = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const sortedItems = useMemo(() => [...setlistItems].sort((a, b) => a.position - b.position), [setlistItems]);
  const summary = useMemo(() => summarizeSetlist(sortedItems, songs), [sortedItems, songs]);

  function replaceItem(next: SetlistItem) {
    onItemsChange(setlistItems.map((item) => item.id === next.id ? next : item));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (!canEdit || target < 0 || target >= sortedItems.length) return;
    const previous = [...setlistItems];
    const next = [...sortedItems];
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((item, position) => ({ ...item, position }));
    onItemsChange(reordered);
    startTransition(async () => {
      try {
        await updateSetlistOrder(playlistId, adminToken, reordered.map((item) => item.id), shareCode);
      } catch (error) {
        onItemsChange(previous);
        showAlert(error instanceof Error ? error.message : "순서 변경에 실패했습니다.");
      }
    });
  }

  const remove = useCallback(async (itemId: string) => {
    const ok = await showDanger("이 항목을 삭제하시겠습니까?");
    if (!ok) return;
    const previous = [...setlistItems];
    onItemsChange(setlistItems.filter((item) => item.id !== itemId));
    startTransition(async () => {
      try {
        await removeSetlistItem(playlistId, adminToken, itemId, shareCode);
      } catch (error) {
        onItemsChange(previous);
        showAlert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
      }
    });
  }, [adminToken, onItemsChange, playlistId, setlistItems, shareCode, showAlert, showDanger]);

  function togglePermission() {
    const next: SetlistEditMode = editMode === "everyone" ? "host_only" : "everyone";
    const previous = editMode;
    onEditModeChange(next);
    startTransition(async () => {
      try {
        await updateSetlistEditMode(playlistId, adminToken, next, shareCode);
      } catch (error) {
        onEditModeChange(previous);
        showAlert(error instanceof Error ? error.message : "편집 권한 변경에 실패했습니다.");
      }
    });
  }

  if (loading) return <div className="mt-6 py-16 text-center text-text-subtle"><span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-primary" /><p className="mt-3">셋리스트 불러오는 중...</p></div>;

  return (
    <div className="mt-3">
      <h2 className="hidden print:block print:text-2xl print:font-bold">{title}</h2>
      {isAdmin && (
        <button type="button" onClick={togglePermission} disabled={isPending} className="mb-4 flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-surface px-3 text-left print:hidden">
          <span><strong className="block text-sm text-text">셋리스트 편집 제한</strong><span className="text-caption text-text-muted">{editMode === "everyone" ? "모두 추가·수정·순서 변경·삭제 가능" : "방장만 편집 가능"}</span></span>
          <span className={`relative h-7 w-12 rounded-full transition-colors ${editMode === "host_only" ? "bg-primary" : "bg-border-strong"}`} aria-hidden><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${editMode === "host_only" ? "translate-x-6" : "translate-x-1"}`} /></span>
        </button>
      )}

      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div className="min-w-0 flex-1 text-sm text-text-muted">
          <span className="tabular-nums">{summary.songCount}곡</span>
          <span className="mx-1.5 text-text-subtle">·</span>
          <strong className="font-medium tabular-nums text-primary">{formatRuntime(summary.totalRuntime)}</strong>
          {summary.missingDurationCount > 0 && <span className="ml-1.5 text-caption text-warning">· {summary.missingDurationCount}곡 시간 미입력</span>}
        </div>
        <SetlistShareButton shareCode={shareCode} title={title} />
      </div>

      {sortedItems.length === 0 ? (
        <div className="py-12 text-center text-text-subtle"><p className="text-lg font-medium">셋리스트가 비어있어요</p><p className="mt-1 text-sm">투표 리스트에서 곡을 추가해보세요.</p></div>
      ) : (
        <div className={`space-y-2 ${isPending ? "opacity-70" : ""}`}>
          {sortedItems.map((item, index) => {
            if (item.item_type === "interval") return <IntervalBlock key={item.id} item={item} index={index} total={sortedItems.length} canEdit={canEdit} onEdit={() => setEditing(item)} onMoveUp={() => move(index, -1)} onMoveDown={() => move(index, 1)} onRemove={() => remove(item.id)} />;
            const song = item.song_id ? songMap.get(item.song_id) : null;
            if (!song) return null;
            const duration = effectiveSetlistDuration(item, song);
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <span className="w-5 shrink-0 text-center text-xs text-text-subtle">{index + 1}</span>
                {song.thumbnail_url && <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg"><Image src={song.thumbnail_url} alt="" fill sizes="40px" className="object-cover" /></div>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text">{effectiveSetlistTitle(item, song)}</p><p className="text-xs text-text-muted">{song.artist || "아티스트 미입력"}{duration != null ? ` · ${formatRuntime(duration)}` : " · 시간 미입력"}</p></div>
                {canEdit && <div className="flex basis-full items-center justify-end border-t border-border pt-2 print:hidden">
                  <button onClick={() => setEditing(item)} className="flex min-h-11 min-w-11 items-center justify-center text-text-subtle hover:text-text" aria-label="곡 블록 수정">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                  </button>
                  <button onClick={() => move(index, -1)} disabled={index === 0} className="flex min-h-11 min-w-11 items-center justify-center text-text-subtle disabled:opacity-30" aria-label="위로">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={() => move(index, 1)} disabled={index === sortedItems.length - 1} className="flex min-h-11 min-w-11 items-center justify-center text-text-subtle disabled:opacity-30" aria-label="아래로">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button onClick={() => remove(item.id)} className="min-h-11 min-w-11 text-danger" aria-label="삭제">×</button>
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && <div className="mt-4 print:hidden">{showAddForm ? <AddIntervalForm playlistId={playlistId} shareCode={shareCode} adminToken={adminToken} nextPosition={sortedItems.length} onAdded={(item) => { onItemsChange([...setlistItems, item]); setShowAddForm(false); }} onCancel={() => setShowAddForm(false)} /> : <button onClick={() => setShowAddForm(true)} className="min-h-11 w-full rounded-xl border-2 border-dashed border-border text-sm text-text-subtle hover:border-primary/50 hover:text-primary">+ 인터벌 블록 추가</button>}</div>}

      {editing && <SetlistItemEditModal item={editing} song={editing.song_id ? songMap.get(editing.song_id) : null} playlistId={playlistId} shareCode={shareCode} adminToken={adminToken} onSaved={replaceItem} onClose={() => setEditing(null)} />}
    </div>
  );
}
