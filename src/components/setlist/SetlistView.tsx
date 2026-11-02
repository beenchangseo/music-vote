"use client";

import { startTransition as startModeSwitch, useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { BlockCard } from "./BlockCards";
import InsertSheet, { type InsertStep } from "./InsertSheet";
import type { InsertTarget } from "./SetlistEditList";
import SetlistItemEditModal from "./SetlistItemEditModal";
import SetlistShareButton from "./SetlistShareButton";
import { RailEnd, RailStart } from "./TimelineRail";
import ScreenToolbar, { ToolbarButton } from "../ui/ScreenToolbar";
import { useDialog } from "../ui/DialogProvider";
import { insertSetlistBlock, removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import { track } from "@/lib/analytics";
import { setlistMessage } from "@/lib/setlist-messages";
import {
  formatRuntime,
  moveSetlistBlock,
  setlistBlocks,
  setlistBlockTitle,
  setlistInsertSlots,
  setlistPlayOrder,
  summarizeSetlist,
  type NewSetlistBlock,
  type SetlistEditAccess,
} from "@/domain/setlist";
import { displayArtist, displayTitle } from "@/domain/song-meta";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import type { PlayerState } from "@/hooks/usePlayerQueue";

/** "후보곡에서 넣기"는 점수 높은 5곡 + 더 보기. */
const COLLAPSED_SUGGESTIONS = 5;

// dnd-kit rides in this chunk, so members who only read the setlist never download it. It has no `loading` on purpose.
// Without one next/dynamic adds no Suspense of its own, and the edit-mode switch is a transition, so the view list stays
// on screen until the chunk is in. The prefetch below calls this same loader. An import() written inside dynamic() gets
// a wrapper chunk of its own, which costs one more round trip after the tap.
const loadEditList = () => import("./SetlistEditList");
const SetlistEditList = dynamic(loadEditList);

interface Props {
  setlistItems: SetlistItem[];
  /** 점수 순으로 정렬된 후보곡. */
  songs: SongWithScore[];
  playlistId: string;
  shareCode: string;
  adminToken: string | null;
  loading: boolean;
  /** 서버에 닿은 셋리스트. 쓰기는 닿았지만 목록을 못 읽었으면 지금 셋리스트를 고치는 함수다. 받는 쪽이 다른 화면에 알린다. */
  onItemsChange: (items: SetStateAction<SetlistItem[]>) => void;
  title: string;
  access: SetlistEditAccess;
  /** 이 곡부터 셋리 순서로 재생한다. */
  onPlay?: (songId: string) => void;
  /** 지금 플레이어. 셋리 큐에서 재생 중인 행에 표시를 달고, 전체 듣기가 새 재생인지 가른다. */
  player?: Pick<PlayerState, "currentSongId" | "source" | "isPlaying">;
}

export default function SetlistView({ setlistItems, songs, playlistId, shareCode, adminToken, loading, onItemsChange, title, access, onPlay, player }: Props) {
  const [isPending, startTransition] = useTransition();
  // A drop or a removal shows at once and falls back to the server list when the write settles or fails.
  const [shownItems, showItems] = useOptimistic(setlistItems, (current: SetlistItem[], change: (items: SetlistItem[]) => SetlistItem[]) => change(current));
  const [inserting, setInserting] = useState<{ target: InsertTarget; step: InsertStep } | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<SetlistItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const { showDanger, showAlert } = useDialog();
  const canEdit = access === "edit";

  const songMap = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const sortedItems = useMemo(() => [...shownItems].sort((a, b) => a.position - b.position), [shownItems]);
  const summary = useMemo(() => summarizeSetlist(sortedItems, songs), [sortedItems, songs]);
  // 공연 순서를 짤 때 알고 싶은 건 곡 길이가 아니라 "이 곡 시작할 때 몇 분 지났나"다.
  const blocks = useMemo(() => setlistBlocks(sortedItems, songs), [sortedItems, songs]);
  const intervalCount = blocks.filter((block) => block.kind === "interval").length;
  const playOrder = useMemo(() => setlistPlayOrder(sortedItems, songs), [sortedItems, songs]);
  const showEditToggle = canEdit && blocks.length > 0;
  const showHostOnlyNotice = access === "locked_to_host";
  const playingSongId = player?.source === "setlist" && player.isPlaying ? player.currentSongId : null;
  const suggestions = useMemo(() => {
    const inSetlist = new Set(sortedItems.map((item) => item.song_id).filter(Boolean));
    return songs.filter((song) => !inSetlist.has(song.id));
  }, [songs, sortedItems]);
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, COLLAPSED_SUGGESTIONS);
  const showEditControls = showEditToggle && editMode;
  const editToggleRef = useRef<HTMLButtonElement>(null);

  // Fetched once 편집 is on screen, so the tap swaps lists at once. A swap that lands more than 500ms after the tap counts
  // as layout shift, and a slow phone network takes that long to bring the chunk.
  useEffect(() => {
    if (showEditToggle) void loadEditList();
  }, [showEditToggle]);

  // The view list has no handle to focus. It takes an insert only from the empty setlist, whose add buttons vanish once
  // the block lands, so focus goes to the toggle that opens the handles.
  useEffect(() => {
    if (focusItemId && !showEditControls) editToggleRef.current?.focus();
  }, [focusItemId, showEditControls]);

  function replaceItem(next: SetlistItem) {
    onItemsChange(setlistItems.map((item) => item.id === next.id ? next : item));
  }

  function reorder(activeId: string, overId: string) {
    const next = moveSetlistBlock(shownItems, blocks, activeId, overId);
    if (!canEdit || !next) return;
    startTransition(async () => {
      showItems(() => next);
      const result = await updateSetlistOrder(playlistId, adminToken, next.map((item) => item.id), shareCode).catch(() => null);
      if (result?.success) onItemsChange(result.items);
      else showAlert(setlistMessage(result?.reason ?? "write_failed"));
    });
  }

  /** 넣으면 null, 시트에 남길 문구가 있으면 그 문구. */
  async function insert(target: InsertTarget, block: NewSetlistBlock): Promise<string | null> {
    const result = await insertSetlistBlock(playlistId, target.slot, block, shareCode).catch(() => null);
    if (!result?.success) {
      const reason = result?.reason ?? "write_failed";
      if (reason !== "slot_gone") return setlistMessage(reason);
      setInserting(null);
      showAlert(setlistMessage(reason));
      return null;
    }
    onItemsChange(result.items);
    setInserting(null);
    setFocusItemId(result.itemId);
    const added = setlistBlocks(result.items, songs).find((candidate) => candidate.item.id === result.itemId);
    if (added) setStatus(`「${setlistBlockTitle(added)}」 블록을 넣었어요`);
    return null;
  }

  const remove = useCallback(async (itemId: string) => {
    const ok = await showDanger("이 항목을 삭제하시겠습니까?");
    if (!ok) return;
    startTransition(async () => {
      showItems((items) => items.filter((item) => item.id !== itemId));
      const result = await removeSetlistItem(playlistId, adminToken, itemId, shareCode).catch(() => null);
      if (result?.success) onItemsChange(result.items ?? ((items) => items.filter((item) => item.id !== itemId)));
      else showAlert(setlistMessage(result?.reason ?? "write_failed"));
    });
  }, [adminToken, onItemsChange, playlistId, shareCode, showAlert, showDanger, showItems]);

  function addFromCandidates(songId: string) {
    if (!canEdit || addingSongId) return;
    setAddingSongId(songId);
    startTransition(async () => {
      const result = await insertSetlistBlock(playlistId, { before: null }, { kind: "song", songId }, shareCode).catch(() => null);
      if (result?.success) onItemsChange(result.items);
      else showAlert(setlistMessage(result?.reason ?? "write_failed"));
      setAddingSongId(null);
    });
  }

  function openAtEnd(step: InsertStep) {
    const slots = setlistInsertSlots(blocks, summary.totalRuntime);
    setInserting({ target: slots[slots.length - 1], step });
  }

  if (loading) {
    return (
      <div className="mt-6 py-16 text-center text-text-subtle">
        <span className="inline-block h-8 w-8 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
        <p className="mt-3">셋리스트 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="hidden print:block print:text-2xl print:font-bold">{title}</h2>

      <ScreenToolbar
        stat={formatRuntime(summary.totalRuntime)}
        caption={
          <>
            <span>{summary.songCount}곡</span>
            {intervalCount > 0 && <span>· 인터벌 {intervalCount}</span>}
            {summary.missingDurationCount > 0 && (
              <span className="text-warning">· {summary.missingDurationCount}곡 시간 미입력</span>
            )}
          </>
        }
        actions={
          <>
            {!showEditControls && onPlay && playOrder.length > 0 && (
              <ToolbarButton
                label="셋리 전체 듣기"
                icon={
                  <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                }
                // 내보내기 always sits beside it, and with the label the runtime cell overflows on a 320px phone.
                compact
                onClick={() => {
                  // Counted like the header's 전체 듣기: only a start from an empty player, so the two sources compare.
                  if (!player?.currentSongId) track("play_all_started", { source: "setlist", song_count: playOrder.length });
                  onPlay(playOrder[0].id);
                }}
              />
            )}
            {showEditToggle && (
              <ToolbarButton
                ref={editToggleRef}
                label={showEditControls ? "완료" : "편집"}
                pressed={showEditControls}
                onClick={() => {
                  startModeSwitch(() => setEditMode((value) => !value));
                  setFocusItemId(null);
                }}
              />
            )}
            {/* Two lines on a phone, so the runtime keeps its cell. */}
            {showHostOnlyNotice && <span className="px-1 text-caption text-text-muted max-sm:max-w-20 break-keep">방장만 편집할 수 있어요</span>}
            {!showEditControls && <SetlistShareButton shareCode={shareCode} title={title} />}
          </>
        }
      >
        {showEditControls && <p className="mt-2 text-caption text-text-muted">≡ 를 끌어 순서를 바꾸고, (+) 로 그 자리에 넣어요</p>}
      </ScreenToolbar>

      {blocks.length === 0 ? (
        <div className="py-10 text-center text-text-subtle">
          <p className="text-lg font-medium">셋리스트가 비어있어요</p>
          <p className="mt-1 text-sm">{canEdit ? "아래 후보곡에서 공연할 곡을 넣어 보세요." : "투표 리스트에서 곡을 추가해보세요."}</p>
        </div>
      ) : showEditControls ? (
        <SetlistEditList
          blocks={blocks}
          totalRuntime={summary.totalRuntime}
          saving={isPending}
          focusItemId={focusItemId}
          onReorder={reorder}
          onOpenSlot={(target) => setInserting({ target, step: "choose" })}
          onEdit={setEditing}
          onRemove={remove}
        />
      ) : (
        <>
          <ol aria-label="셋리스트" className={isPending ? "opacity-70" : ""}>
            {blocks.map((block, index) => {
              const nowPlaying = block.kind === "song" && block.song.id === playingSongId;
              return (
                <li key={block.item.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem]" aria-current={nowPlaying ? "true" : undefined}>
                  <div className="flex flex-col justify-center py-1">
                    <BlockCard
                      block={block}
                      editing={false}
                      onEdit={() => setEditing(block.item)}
                      onRemove={() => remove(block.item.id)}
                      nowPlaying={nowPlaying}
                      onPlay={block.kind === "song" && onPlay ? () => onPlay(block.song.id) : undefined}
                    />
                  </div>
                  <RailStart kind={block.kind} previous={blocks[index - 1]?.kind} start={block.start} />
                </li>
              );
            })}
          </ol>
          <RailEnd last={blocks[blocks.length - 1].kind} total={summary.totalRuntime} />
        </>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>

      {/* Once the setlist has blocks, adding goes through the (+) rows in edit mode (grill decision 5). */}
      {canEdit && blocks.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <button
            onClick={() => openAtEnd("original")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-dashed border-primary/30 px-4 text-sm font-medium text-primary-fg transition-colors hover:bg-primary/10"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            자작곡 블록 추가
          </button>
          <button
            onClick={() => openAtEnd("interval")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-dashed border-warning/40 px-4 text-sm font-medium text-warning transition-colors hover:bg-warning-soft/30"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            인터벌 블록 추가
          </button>
        </div>
      )}

      {/* Spotify "추천 곡": candidates not in the setlist yet, best score first, one tap to add. */}
      {canEdit && !showEditControls && suggestions.length > 0 && (
        <section aria-labelledby="setlist-suggestions" className="mt-10 print:hidden">
          <h3 id="setlist-suggestions" className="text-h3 font-bold text-text">후보곡에서 넣기</h3>
          <p className="mt-0.5 text-caption text-text-muted">점수 높은 순이에요. 넣으면 셋리스트 맨 끝에 붙어요</p>
          <ul className="mt-3">
            {visibleSuggestions.map((song) => (
              <li key={song.id} className="flex items-center gap-3 py-2">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-control bg-surface-elevated">
                  {song.thumbnail_url && <Image src={song.thumbnail_url} alt="" fill sizes="44px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{displayTitle(song.title)}</span>
                  <span className="block truncate text-caption text-text-muted">
                    {displayArtist(song.artist, song.title) || "아티스트 미입력"}
                    <span className="mx-1 text-text-subtle" aria-hidden>·</span>
                    <span className="tabular-nums">{song.score > 0 ? `+${song.score}` : song.score}점</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => addFromCandidates(song.id)}
                  disabled={!!addingSongId}
                  aria-label={`${displayTitle(song.title)} 셋리스트에 넣기`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-surface-hover hover:text-primary-fg disabled:opacity-40"
                >
                  {addingSongId === song.id ? (
                    <span className="h-4 w-4 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
                  ) : (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" d="M12 8v8M8 12h8" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!showAllSuggestions && suggestions.length > COLLAPSED_SUGGESTIONS && (
            <button
              type="button"
              onClick={() => setShowAllSuggestions(true)}
              className="mt-2 inline-flex min-h-11 items-center rounded-pill border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-hover"
            >
              더 보기 ({suggestions.length - COLLAPSED_SUGGESTIONS}곡)
            </button>
          )}
        </section>
      )}

      {inserting && (
        <InsertSheet
          target={inserting.target}
          initialStep={inserting.step}
          candidates={suggestions}
          onInsert={(block) => insert(inserting.target, block)}
          onClose={() => setInserting(null)}
        />
      )}

      {editing && <SetlistItemEditModal item={editing} song={editing.song_id ? songMap.get(editing.song_id) : null} playlistId={playlistId} shareCode={shareCode} adminToken={adminToken} onSaved={replaceItem} onClose={() => setEditing(null)} />}
    </div>
  );
}
