"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import IntervalBlock from "./IntervalBlock";
import AddIntervalForm from "./AddIntervalForm";
import SetlistCalendarButton from "./SetlistCalendarButton";
import PosterUploadButton from "./PosterUploadButton";
import Image from "next/image";
import { useDialog } from "./DialogProvider";
import { track } from "@/lib/analytics";
import { removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import type { SetlistItem, SongWithScore } from "@/lib/types";

interface SetlistViewProps {
  setlistItems: SetlistItem[];
  songs: SongWithScore[];
  playlistId: string;
  shareCode: string;
  isAdmin: boolean;
  adminToken: string | null;
  loading: boolean;
  onItemsChange: (items: SetlistItem[]) => void;
  /** 셋리스트 공유 카드/OG에 사용 */
  title: string;
  /** 공연 포스터 URL (Storage public) — 배경 블러용 */
  posterUrl?: string | null;
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
  title,
  posterUrl,
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
      <div className="mt-6 text-center py-16 text-text-subtle">
        <span className="inline-block w-8 h-8 border-2 border-border-strong border-t-primary rounded-full animate-spin" />
        <p className="mt-3">셋리스트 불러오는 중...</p>
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="mt-6">
        <div className="text-center py-12 text-text-subtle">
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
              className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-sm text-text-subtle hover:text-primary transition-colors"
            >
              + 인터벌 블럭 추가
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-5">
      {/* Blurred poster background — set behind content */}
      {posterUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-4 -inset-y-5 overflow-hidden"
        >
          <Image
            src={posterUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 512px"
            className="object-cover scale-105 blur-md opacity-60"
            priority={false}
          />
          <div className="absolute inset-0 bg-bg/50" />
        </div>
      )}

      <div className="relative">
      {/* Runtime + Actions toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 print:hidden">
        <div className="text-sm text-text-muted min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="tabular-nums">{sortedItems.length}개</span>
            <span className="text-text-subtle" aria-hidden>·</span>
            <span className="text-primary font-medium tabular-nums">
              {totalRuntime > 0 ? formatTime(totalRuntime) : "0:00"}
            </span>
            {missingDurationCount > 0 && (
              <span
                className="text-caption text-warning truncate"
                title={`${missingDurationCount}곡 시간 미입력 — 합주 모드에서 입력`}
              >
                · {missingDurationCount}곡 시간 미입력
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <SetlistCalendarButton
            shareCode={shareCode}
            totalRuntimeSeconds={totalRuntime}
            defaultTitle={`${title} — 합주`}
          />
          {isAdmin && (
            <PosterUploadButton
              playlistId={playlistId}
              adminToken={adminToken}
              shareCode={shareCode}
              hasPoster={!!posterUrl}
            />
          )}
          <button
            type="button"
            onClick={() => {
              track("setlist_exported", { format: "print" });
              window.print();
            }}
            className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-surface-hover hover:bg-border-strong text-caption text-text-muted hover:text-text font-semibold transition-colors"
            aria-label="인쇄 또는 PDF 저장"
            title="인쇄 / PDF로 저장"
          >
            <PrintIcon /> 인쇄
          </button>
        </div>
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
                isAdmin={isAdmin}
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
              <span className="text-xs text-text-subtle w-5 text-center shrink-0">{index + 1}</span>

              {song.thumbnail_url && (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <Image src={song.thumbnail_url} alt={song.title} fill sizes="40px" className="object-cover" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{song.title}</p>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {song.artist && <span className="truncate">{song.artist}</span>}
                  {song.duration_seconds && (
                    <>
                      <span className="text-text-subtle">·</span>
                      <span>{formatTime(song.duration_seconds)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Controls — all participants */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-2.5 text-text-subtle hover:text-text disabled:opacity-30 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => handleMoveDown(index)} disabled={index === sortedItems.length - 1} className="p-2.5 text-text-subtle hover:text-text disabled:opacity-30 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button onClick={() => handleRemove(item.id)} className="p-2.5 text-text-subtle hover:text-red-400 transition-colors">
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
            className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-sm text-text-subtle hover:text-primary transition-colors"
          >
            + 인터벌 블럭 추가
          </button>
        )}
      </div>
      </div>
    </div>
  );
}


function PrintIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829q-.094-.124-.184-.252M6.72 13.829a3 3 0 0 0 .12.243m-.12-.243-.077-.13M9 6.75V15m6-6v8.25m.124.282A23.074 23.074 0 0 1 12 18.75c-1.605 0-3.18-.182-4.7-.524-.341-.07-.682-.142-.953-.16M21 16.5c0 2.485-2.099 4.5-4.688 4.5-1.935 0-3.597-1.126-4.312-2.733-.715 1.607-2.377 2.733-4.313 2.733C4.1 21 2 18.985 2 16.5V8.25c0-1.243 1.05-2.25 2.344-2.25h3.5c1.295 0 2.344 1.007 2.344 2.25v8.25c0 .621.523 1.125 1.172 1.125.648 0 1.171-.504 1.171-1.125V8.25c0-1.243 1.05-2.25 2.344-2.25h3.5C20.95 6 22 7.007 22 8.25z"
      />
    </svg>
  );
}
