"use client";

import { startTransition as startModeSwitch, useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { BlockCard } from "./BlockCards";
import InsertSheet, { type InsertStep } from "./InsertSheet";
import type { InsertTarget } from "./SetlistEditList";
import SetlistItemEditModal from "./SetlistItemEditModal";
import SetlistShareButton from "./SetlistShareButton";
import { RailEnd, RailRow } from "./TimelineRail";
import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import IconButton from "../ui/IconButton";
import RoundButton from "../ui/RoundButton";
import { DoneIcon, EditIcon, SettingsIcon } from "../ui/icons";
import { useDialog } from "../ui/DialogProvider";
import { RoomCover } from "../band/BandArt";
import PlaylistActionRow, { type PlaylistMenuItem } from "../playlist/PlaylistActionRow";
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
  loading: boolean;
  /** 서버에 닿은 셋리스트. 쓰기는 닿았지만 목록을 못 읽었으면 지금 셋리스트를 고치는 함수다. 받는 쪽이 다른 화면에 알린다. */
  onItemsChange: (items: SetStateAction<SetlistItem[]>) => void;
  title: string;
  access: SetlistEditAccess;
  /** 이 곡부터 셋리 순서로 재생한다. */
  onPlay?: (songId: string) => void;
  /** 지금 플레이어. 셋리 큐에서 재생 중인 행에 표시를 달고, 전체 듣기가 새 재생인지 가른다. */
  player?: Pick<PlayerState, "currentSongId" | "source" | "isPlaying">;
  /** 머리의 작은 커버. 후보곡 머리와 같은 모자이크다. */
  coverThumbs?: string[];
  /** 동작 줄 오른쪽의 공지 원판. 후보곡과 같은 AnnouncementButton 이다. */
  notice?: ReactNode;
  /** ⋯ 시트의 "플레이리스트 설정". 방장에게만 넘긴다. */
  onOpenSettings?: () => void;
}

export default function SetlistView({
  setlistItems,
  songs,
  playlistId,
  shareCode,
  loading,
  onItemsChange,
  title,
  access,
  onPlay,
  player,
  coverThumbs = [],
  notice,
  onOpenSettings,
}: Props) {
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
      const result = await updateSetlistOrder(playlistId, next.map((item) => item.id), shareCode).catch(() => null);
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
    const ok = await showDanger("이 항목을 삭제할까요?");
    if (!ok) return;
    startTransition(async () => {
      showItems((items) => items.filter((item) => item.id !== itemId));
      const result = await removeSetlistItem(playlistId, itemId, shareCode).catch(() => null);
      if (result?.success) onItemsChange(result.items ?? ((items) => items.filter((item) => item.id !== itemId)));
      else showAlert(setlistMessage(result?.reason ?? "write_failed"));
    });
  }, [onItemsChange, playlistId, shareCode, showAlert, showDanger, showItems]);

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

  const metaParts = [
    { key: "songs", text: `${summary.songCount}곡`, className: "font-semibold text-text" },
    { key: "runtime", text: formatRuntime(summary.totalRuntime), className: "" },
    ...(intervalCount > 0 ? [{ key: "intervals", text: `인터벌 ${intervalCount}`, className: "" }] : []),
    ...(summary.missingDurationCount > 0
      ? [{ key: "missing", text: `${summary.missingDurationCount}곡 시간 미입력`, className: "text-warning" }]
      : []),
  ];
  const menu: PlaylistMenuItem[] = onOpenSettings
    ? [{ label: "플레이리스트 설정", icon: <SettingsIcon className="size-5 text-text-muted" />, onSelect: onOpenSettings }]
    : [];

  return (
    <div>
      {/* The candidates header at Spotify's compact playlist size: a small cover with the title and totals beside it. */}
      <div className="mt-3 flex items-center gap-4">
        <RoomCover thumbs={coverThumbs} sizes="112px" className="size-28 print:hidden" />
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 break-keep text-h3 font-bold leading-snug text-text">{title}</h1>
          {!loading && (
            <p className="mt-1 text-sm text-text-muted tabular-nums">
              {metaParts.map((part, i) => (
                <span key={part.key}>
                  {i > 0 && <span className="mx-1.5 text-text-subtle" aria-hidden>·</span>}
                  <span className={part.className}>{part.text}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 mb-4">
        <PlaylistActionRow
          title={title}
          share={<SetlistShareButton shareCode={shareCode} title={title} />}
          edit={
            showEditToggle ? (
              <RoundButton
                ref={editToggleRef}
                size="md"
                pressed={showEditControls}
                aria-label={showEditControls ? "완료" : "편집"}
                onClick={() => {
                  startModeSwitch(() => setEditMode((value) => !value));
                  setFocusItemId(null);
                }}
              >
                {showEditControls ? <DoneIcon /> : <EditIcon />}
              </RoundButton>
            ) : (
              // Two lines on a narrow phone, so the notice and play discs keep their row.
              showHostOnlyNotice && <span className="ml-1 max-w-28 break-keep text-caption text-text-muted">방장만 편집할 수 있어요</span>
            )
          }
          menu={menu}
          notice={notice}
          play={
            !showEditControls && onPlay && playOrder.length > 0
              ? {
                  label: "셋리 전체 듣기",
                  playing: false,
                  onClick: () => {
                    // Counted like the header's 전체 듣기: only a start from an empty player, so the two sources compare.
                    if (!player?.currentSongId) track("play_all_started", { source: "setlist", song_count: playOrder.length });
                    onPlay(playOrder[0].id);
                  },
                }
              : undefined
          }
        />
      </div>
      {showEditControls && <p className="mb-3 text-caption text-text-muted">≡ 를 끌어 순서를 바꾸고, (+) 로 그 자리에 넣어요</p>}

      {loading ? (
        <div className="mt-6 py-16 text-center text-text-subtle">
          <span className="inline-block h-8 w-8 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
          <p className="mt-3">셋리스트 불러오는 중…</p>
        </div>
      ) : (
        <>
          {blocks.length === 0 ? (
            <EmptyState
              title="셋리스트가 비어있어요"
              description={canEdit ? "아래 후보곡에서 공연할 곡을 넣어 보세요." : "투표 리스트에서 곡을 추가해보세요."}
            />
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
                {blocks.map((block) => {
                  const nowPlaying = block.kind === "song" && block.song.id === playingSongId;
                  return (
                    <RailRow key={block.item.id} kind={block.kind} start={block.start} current={nowPlaying}>
                      <BlockCard
                        block={block}
                        editing={false}
                        onEdit={() => setEditing(block.item)}
                        onRemove={() => remove(block.item.id)}
                        nowPlaying={nowPlaying}
                        onPlay={block.kind === "song" && onPlay ? () => onPlay(block.song.id) : undefined}
                      />
                    </RailRow>
                  );
                })}
              </ol>
              <RailEnd total={summary.totalRuntime} />
            </>
          )}
          <p role="status" className="sr-only">
            {status}
          </p>

          {/* Once the setlist has blocks, adding goes through the (+) rows in edit mode (grill decision 5). */}
          {canEdit && blocks.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <Button variant="tonal" onClick={() => openAtEnd("original")}>
                <svg className="size-4 text-primary-fg" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                자작곡 블록 추가
              </Button>
              <Button variant="tonal" onClick={() => openAtEnd("interval")}>
                <svg className="size-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                인터벌 블록 추가
              </Button>
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
                    <IconButton bare onClick={() => addFromCandidates(song.id)} disabled={!!addingSongId} aria-label={`${displayTitle(song.title)} 셋리스트에 넣기`}>
                      {addingSongId === song.id ? (
                        <span aria-hidden className="size-4 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
                      ) : (
                        <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                          <circle cx="12" cy="12" r="9" />
                          <path strokeLinecap="round" d="M12 8v8M8 12h8" />
                        </svg>
                      )}
                    </IconButton>
                  </li>
                ))}
              </ul>
              {!showAllSuggestions && suggestions.length > COLLAPSED_SUGGESTIONS && (
                <Button variant="tonal" size="sm" className="mt-2" onClick={() => setShowAllSuggestions(true)}>
                  더 보기 ({suggestions.length - COLLAPSED_SUGGESTIONS}곡)
                </Button>
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

          {editing && <SetlistItemEditModal item={editing} song={editing.song_id ? songMap.get(editing.song_id) : null} playlistId={playlistId} shareCode={shareCode} onSaved={replaceItem} onClose={() => setEditing(null)} />}
        </>
      )}
    </div>
  );
}
