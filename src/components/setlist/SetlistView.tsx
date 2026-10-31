"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Image from "next/image";
import AddIntervalForm from "./AddIntervalForm";
import AddOriginalForm from "./AddOriginalForm";
import { IntervalBlock, MoveButton, OriginalBlock, SongBlock } from "./BlockCards";
import SetlistItemEditModal from "./SetlistItemEditModal";
import SetlistShareButton from "./SetlistShareButton";
import { RailEnd, RailStart } from "./TimelineRail";
import Button from "../ui/Button";
import ScreenToolbar from "../ui/ScreenToolbar";
import { useDialog } from "../ui/DialogProvider";
import { addSongToSetlist, removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import { track } from "@/lib/analytics";
import { formatRuntime, moveSetlistBlock, setlistBlocks, setlistPlayOrder, summarizeSetlist, type SetlistEditAccess } from "@/domain/setlist";
import { displayArtist } from "@/domain/song-meta";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import type { PlayerState } from "@/hooks/usePlayerQueue";

/** "후보곡에서 넣기"는 점수 높은 5곡 + 더 보기. */
const COLLAPSED_SUGGESTIONS = 5;

interface Props {
  setlistItems: SetlistItem[];
  /** 점수 순으로 정렬된 후보곡. */
  songs: SongWithScore[];
  playlistId: string;
  shareCode: string;
  adminToken: string | null;
  loading: boolean;
  onItemsChange: (items: SetlistItem[]) => void;
  title: string;
  access: SetlistEditAccess;
  /** 플레이리스트 설정 버튼. 세 화면 툴바의 같은 자리에 온다. */
  actions?: React.ReactNode;
  /** 이 곡부터 셋리 순서로 재생한다. */
  onPlay?: (songId: string) => void;
  /** 지금 플레이어. 셋리 큐에서 재생 중인 행에 표시를 달고, 전체 듣기가 새 재생인지 가른다. */
  player?: Pick<PlayerState, "currentSongId" | "source" | "isPlaying">;
}

export default function SetlistView({ setlistItems, songs, playlistId, shareCode, adminToken, loading, onItemsChange, title, access, actions, onPlay, player }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddOriginalForm, setShowAddOriginalForm] = useState(false);
  const [editing, setEditing] = useState<SetlistItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const { showDanger, showAlert } = useDialog();
  const canEdit = access === "edit";

  const songMap = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const sortedItems = useMemo(() => [...setlistItems].sort((a, b) => a.position - b.position), [setlistItems]);
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
  // ▲▼ 로 옮긴 행이 순간이동하지 않고 움직이는 게 보이게 한다.
  const [listParent] = useAutoAnimate({ duration: 250, easing: "ease-in-out" });
  const showEditControls = showEditToggle && editMode;

  function replaceItem(next: SetlistItem) {
    onItemsChange(setlistItems.map((item) => item.id === next.id ? next : item));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (!canEdit || target < 0 || target >= blocks.length) return;
    const previous = [...setlistItems];
    const reordered = moveSetlistBlock(setlistItems, blocks, index, target);
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

  function addFromCandidates(songId: string) {
    if (!canEdit || addingSongId) return;
    setAddingSongId(songId);
    startTransition(async () => {
      try {
        const item = await addSongToSetlist(playlistId, adminToken, songId, shareCode);
        onItemsChange([...setlistItems, item]);
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "셋리스트 추가에 실패했습니다.");
      } finally {
        setAddingSongId(null);
      }
    });
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
              <Button
                variant="tonal"
                size="sm"
                className="min-h-11 min-w-11"
                onClick={() => {
                  // Counted like the header's 전체 듣기: only a start from an empty player, so the two sources compare.
                  if (!player?.currentSongId) track("play_all_started", { source: "setlist", song_count: playOrder.length });
                  onPlay(playOrder[0].id);
                }}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                {/* With 편집 or the host-only notice beside it, the label squeezes the runtime on a 360px phone. */}
                <span className={showEditToggle || showHostOnlyNotice ? "max-sm:sr-only" : undefined}>셋리 전체 듣기</span>
              </Button>
            )}
            {showEditToggle && (
              <Button variant={showEditControls ? "primary" : "tonal"} size="sm" aria-pressed={showEditControls} onClick={() => setEditMode((value) => !value)}>
                {showEditControls ? "완료" : "편집"}
              </Button>
            )}
            {/* Two lines on a phone, so the runtime keeps its cell. */}
            {showHostOnlyNotice && <span className="px-1 text-caption text-text-muted max-sm:max-w-20 break-keep">방장만 편집할 수 있어요</span>}
            {!showEditControls && <SetlistShareButton shareCode={shareCode} title={title} />}
            {!showEditControls && actions}
          </>
        }
      />

      {blocks.length === 0 ? (
        <div className="py-10 text-center text-text-subtle">
          <p className="text-lg font-medium">셋리스트가 비어있어요</p>
          <p className="mt-1 text-sm">{canEdit ? "아래 후보곡에서 공연할 곡을 넣어 보세요." : "투표 리스트에서 곡을 추가해보세요."}</p>
        </div>
      ) : (
        <>
          <ol ref={listParent} aria-label="셋리스트" className={isPending ? "opacity-70" : ""}>
            {blocks.map((block, index) => {
              const edit = () => setEditing(block.item);
              const drop = () => remove(block.item.id);
              const nowPlaying = block.kind === "song" && block.song.id === playingSongId;
              return (
                <li key={block.item.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem]" aria-current={nowPlaying ? "true" : undefined}>
                  <div className="flex flex-col justify-center py-1">
                    {block.kind === "song" ? (
                      <SongBlock
                        item={block.item}
                        song={block.song}
                        editing={showEditControls}
                        onEdit={edit}
                        onRemove={drop}
                        nowPlaying={nowPlaying}
                        onPlay={onPlay && (() => onPlay(block.song.id))}
                      />
                    ) : block.kind === "original" ? (
                      <OriginalBlock item={block.item} editing={showEditControls} onEdit={edit} onRemove={drop} />
                    ) : (
                      <IntervalBlock item={block.item} editing={showEditControls} onEdit={edit} onRemove={drop} />
                    )}
                  </div>
                  {showEditControls ? (
                    <span className="flex flex-col items-center justify-center print:hidden">
                      <MoveButton direction="up" disabled={index === 0} onClick={() => move(index, -1)} />
                      <MoveButton direction="down" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} />
                    </span>
                  ) : (
                    <RailStart kind={block.kind} previous={blocks[index - 1]?.kind} start={block.start} />
                  )}
                </li>
              );
            })}
          </ol>
          {!showEditControls && <RailEnd last={blocks[blocks.length - 1].kind} total={summary.totalRuntime} />}
        </>
      )}

      {canEdit && (
        <div className="mt-3 print:hidden">
          {showAddForm ? (
            <AddIntervalForm
              playlistId={playlistId}
              shareCode={shareCode}
              adminToken={adminToken}
              nextPosition={sortedItems.length}
              onAdded={(item) => {
                onItemsChange([...setlistItems, item]);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : showAddOriginalForm ? (
            <AddOriginalForm
              playlistId={playlistId}
              shareCode={shareCode}
              adminToken={adminToken}
              nextPosition={sortedItems.length}
              onAdded={(item) => {
                onItemsChange([...setlistItems, item]);
                setShowAddOriginalForm(false);
              }}
              onCancel={() => setShowAddOriginalForm(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAddOriginalForm(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-dashed border-primary/30 px-4 text-sm font-medium text-primary-fg transition-colors hover:bg-primary/10"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                자작곡 블록 추가
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-dashed border-warning/40 px-4 text-sm font-medium text-warning transition-colors hover:bg-warning-soft/30"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                인터벌 블록 추가
              </button>
            </div>
          )}
        </div>
      )}

      {/* Spotify "추천 곡": candidates not in the setlist yet, best score first, one tap to add. */}
      {canEdit && suggestions.length > 0 && (
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
                  <span className="block truncate text-sm font-medium text-text">{song.title}</span>
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
                  aria-label={`${song.title} 셋리스트에 넣기`}
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

      {editing && <SetlistItemEditModal item={editing} song={editing.song_id ? songMap.get(editing.song_id) : null} playlistId={playlistId} shareCode={shareCode} adminToken={adminToken} onSaved={replaceItem} onClose={() => setEditing(null)} />}
    </div>
  );
}
