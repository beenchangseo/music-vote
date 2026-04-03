"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import IntervalBlock from "./IntervalBlock";
import AddIntervalForm from "./AddIntervalForm";
import { useDialog } from "./DialogProvider";
import { removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import type { SetlistItem, SongWithScore } from "@/lib/types";
import Image from "next/image";

interface SetlistViewProps {
  setlistItems: SetlistItem[];
  songs: SongWithScore[];
  playlistId: string;
  shareCode: string;
  isAdmin: boolean;
  adminToken: string | null;
  loading: boolean;
  onItemsChange: (items: SetlistItem[]) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SetlistView({
  setlistItems,
  songs,
  playlistId,
  shareCode,
  isAdmin,
  adminToken,
  loading,
  onItemsChange,
}: SetlistViewProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const { showDanger } = useDialog();

  const songMap = useMemo(() => {
    const map: Record<string, SongWithScore> = {};
    for (const s of songs) map[s.id] = s;
    return map;
  }, [songs]);

  const sortedItems = useMemo(
    () => [...setlistItems].sort((a, b) => a.position - b.position),
    [setlistItems]
  );

  const { totalRuntime, missingDurationCount } = useMemo(() => {
    let total = 0;
    let missing = 0;
    for (const item of sortedItems) {
      if (item.item_type === "song" && item.song_id) {
        const song = songMap[item.song_id];
        if (song?.duration_seconds) {
          total += song.duration_seconds;
        } else {
          missing++;
        }
      }
      if (item.item_type === "interval") {
        total += item.duration_seconds || 0;
      }
    }
    return { totalRuntime: total, missingDurationCount: missing };
  }, [sortedItems, songMap]);

  function handleMoveUp(index: number) {
    if (index <= 0) return;
    const newItems = [...sortedItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    const reordered = newItems.map((item, i) => ({ ...item, position: i }));
    onItemsChange(reordered);

    startTransition(async () => {
      try {
        await updateSetlistOrder(playlistId, adminToken, reordered.map((i) => i.id), shareCode);
      } catch { /* ignore */ }
    });
  }

  function handleMoveDown(index: number) {
    if (index >= sortedItems.length - 1) return;
    const newItems = [...sortedItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    const reordered = newItems.map((item, i) => ({ ...item, position: i }));
    onItemsChange(reordered);

    startTransition(async () => {
      try {
        await updateSetlistOrder(playlistId, adminToken, reordered.map((i) => i.id), shareCode);
      } catch { /* ignore */ }
    });
  }

  const handleRemove = useCallback(async (itemId: string) => {
    const ok = await showDanger("이 항목을 삭제하시겠습니까?");
    if (!ok) return;
    onItemsChange(setlistItems.filter((i) => i.id !== itemId));

    startTransition(async () => {
      try {
        await removeSetlistItem(playlistId, adminToken, itemId, shareCode);
      } catch { /* ignore */ }
    });
  }, [showDanger, onItemsChange, setlistItems, playlistId, adminToken, shareCode]);

  if (loading) {
    return (
      <div className="mt-6 text-center py-16 text-gray-500">
        <span className="inline-block w-8 h-8 border-2 border-gray-600 border-t-primary rounded-full animate-spin" />
        <p className="mt-3">셋리스트 불러오는 중...</p>
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="mt-6">
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">셋리스트가 비어있습니다</p>
          <p className="mt-1 text-sm">플레이리스트에서 곡을 셋리스트에 추가해보세요</p>
        </div>
        <div className="mt-4">
          {showAddForm ? (
            <AddIntervalForm
              playlistId={playlistId}
              shareCode={shareCode}
              nextPosition={0}
              onAdded={(item) => {
                onItemsChange([...setlistItems, item]);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-primary/50 text-sm text-gray-500 hover:text-primary transition-colors"
            >
              + 인터벌 블럭 추가
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {/* Runtime + Print */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          <div>{sortedItems.length}개 항목 · 총 러닝타임 <span className="text-primary font-medium">{totalRuntime > 0 ? formatTime(totalRuntime) : "0:00"}</span></div>
          {missingDurationCount > 0 && (
            <div className="text-xs text-yellow-500 mt-0.5">{missingDurationCount}곡 시간 미입력 — 합주 모드에서 입력</div>
          )}
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors print:hidden"
        >
          인쇄
        </button>
      </div>

      {/* Items */}
      <div className={`space-y-2 ${isPending ? "opacity-70" : ""}`}>
        {sortedItems.map((item, index) => {
          if (item.item_type === "interval") {
            return (
              <IntervalBlock
                key={item.id}
                item={item}
                index={index}
                total={sortedItems.length}
                isAdmin={true}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onRemove={() => handleRemove(item.id)}
              />
            );
          }

          const song = item.song_id ? songMap[item.song_id] : null;
          if (!song) return null;

          return (
            <div
              key={item.id}
              className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3"
            >
              <span className="text-xs text-gray-500 w-5 text-center shrink-0">{index + 1}</span>

              {song.thumbnail_url && (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <Image src={song.thumbnail_url} alt={song.title} fill sizes="40px" className="object-cover" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-100 truncate">{song.title}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {song.artist && <span className="truncate">{song.artist}</span>}
                  {song.duration_seconds && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span>{formatTime(song.duration_seconds)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Controls — all participants */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-200 disabled:opacity-30 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => handleMoveDown(index)} disabled={index === sortedItems.length - 1} className="p-1 text-gray-500 hover:text-gray-200 disabled:opacity-30 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button onClick={() => handleRemove(item.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add interval block — all participants */}
      <div className="mt-4">
        {showAddForm ? (
          <AddIntervalForm
            playlistId={playlistId}
            shareCode={shareCode}
            nextPosition={sortedItems.length}
            onAdded={(item) => {
              onItemsChange([...setlistItems, item]);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-primary/50 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            + 인터벌 블럭 추가
          </button>
        )}
      </div>
    </div>
  );
}
