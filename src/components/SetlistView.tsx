"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Image from "next/image";
import AddIntervalForm from "./AddIntervalForm";
import IntervalBlock, { MinusCircle, MoveButton } from "./IntervalBlock";
import SetlistItemEditModal from "./SetlistItemEditModal";
import SetlistShareButton from "./SetlistShareButton";
import ScreenToolbar from "./ui/ScreenToolbar";
import { useDialog } from "./DialogProvider";
import { addSongToSetlist, removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import { cumulativeStarts, effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, summarizeSetlist } from "@/lib/setlist-domain";
import { displayArtist, formatKey } from "@/lib/song-meta";
import type { SetlistItem, SongWithScore } from "@/lib/types";

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
  canEdit: boolean;
  /** 플레이리스트 설정 버튼. 세 화면 툴바의 같은 자리에 온다. */
  actions?: React.ReactNode;
}

/**
 * 셋리스트 (Spotify 플레이리스트 Mix·편집 화면 문법). 평소에는 공연 순서를 읽는 목록
 * (시작 시각 · 곡 · 길이·BPM·키), "편집"을 누르면 ⊖ 삭제와 ▲▼ 순서 버튼이 나온다.
 * 아래 "후보곡에서 넣기"로 셋리스트 화면 안에서 곡을 채운다.
 */
export default function SetlistView({ setlistItems, songs, playlistId, shareCode, adminToken, loading, onItemsChange, title, canEdit, actions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<SetlistItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const { showDanger, showAlert } = useDialog();

  const songMap = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const sortedItems = useMemo(() => [...setlistItems].sort((a, b) => a.position - b.position), [setlistItems]);
  const summary = useMemo(() => summarizeSetlist(sortedItems, songs), [sortedItems, songs]);
  // 공연 순서를 짤 때 알고 싶은 건 곡 길이가 아니라 "이 곡 시작할 때 몇 분 지났나"다.
  const starts = useMemo(() => cumulativeStarts(sortedItems, songs), [sortedItems, songs]);
  // 인터벌을 건너뛴 곡 번호. 화면에는 "3번째 곡"이 보여야지 "5번째 항목"이 아니다.
  const songNumbers = useMemo(() => {
    let n = 0;
    return sortedItems.map((item) => (item.item_type === "interval" ? 0 : ++n));
  }, [sortedItems]);
  const intervalCount = sortedItems.length - summary.songCount;
  const suggestions = useMemo(() => {
    const inSetlist = new Set(sortedItems.map((item) => item.song_id).filter(Boolean));
    return songs.filter((song) => !inSetlist.has(song.id));
  }, [songs, sortedItems]);
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, COLLAPSED_SUGGESTIONS);
  // ▲▼ 로 옮긴 행이 순간이동하지 않고 움직이는 게 보이게 한다.
  const [listParent] = useAutoAnimate({ duration: 250, easing: "ease-in-out" });
  const showEditControls = canEdit && editMode;

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
        <span className="inline-block h-8 w-8 animate-spin rounded-pill border-2 border-border-strong border-t-primary" />
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
            {canEdit && sortedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setEditMode((value) => !value)}
                aria-pressed={editMode}
                className={`inline-flex h-9 items-center rounded-pill px-4 text-sm font-semibold transition-colors ${
                  editMode ? "bg-primary text-white hover:bg-primary-hover" : "border border-border text-text hover:bg-surface-hover"
                }`}
              >
                {editMode ? "완료" : "편집"}
              </button>
            )}
            <SetlistShareButton shareCode={shareCode} title={title} />
            {actions}
          </>
        }
      />

      {sortedItems.length === 0 ? (
        <div className="py-10 text-center text-text-subtle">
          <p className="text-lg font-medium">셋리스트가 비어있어요</p>
          <p className="mt-1 text-sm">{canEdit ? "아래 후보곡에서 공연할 곡을 넣어 보세요." : "투표 리스트에서 곡을 추가해보세요."}</p>
        </div>
      ) : (
        <ol ref={listParent} className={isPending ? "opacity-70" : ""}>
          {sortedItems.map((item, index) => {
            if (item.item_type === "interval") {
              return (
                <li key={item.id}>
                  <IntervalBlock
                    item={item}
                    index={index}
                    total={sortedItems.length}
                    editMode={showEditControls}
                    onEdit={() => setEditing(item)}
                    onMoveUp={() => move(index, -1)}
                    onMoveDown={() => move(index, 1)}
                    onRemove={() => remove(item.id)}
                  />
                </li>
              );
            }
            const song = item.song_id ? songMap.get(item.song_id) : null;
            if (!song) return null;
            const duration = effectiveSetlistDuration(item, song);
            const key = formatKey(song.key_root, song.key_mode) || song.key_memo;
            const body = (
              <>
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control bg-surface-elevated">
                  {song.thumbnail_url && <Image src={song.thumbnail_url} alt="" fill sizes="48px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="line-clamp-2 block text-body font-medium leading-snug text-text">{effectiveSetlistTitle(item, song)}</span>
                  <span className="mt-0.5 block truncate text-sm text-text-muted">
                    {displayArtist(song.artist, song.title) || "아티스트 미입력"}
                  </span>
                </span>
              </>
            );
            return (
              <li key={item.id} className="flex items-center gap-3 py-2">
                {showEditControls ? (
                  <button onClick={() => remove(item.id)} className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center text-danger print:hidden" aria-label="삭제">
                    <MinusCircle />
                  </button>
                ) : (
                  // 누적 시간이 주인공이고 순서 번호는 보조다.
                  <span className="w-10 shrink-0 text-right">
                    <span className="block text-caption font-semibold leading-none tabular-nums text-text">{formatRuntime(starts[index])}</span>
                    <span className="mt-1 block text-[10px] leading-none tabular-nums text-text-subtle">{songNumbers[index]}</span>
                  </span>
                )}
                {showEditControls ? (
                  <button type="button" onClick={() => setEditing(item)} className="flex min-w-0 flex-1 items-center gap-3" aria-label="곡 블록 수정">
                    {body}
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
                )}
                {showEditControls ? (
                  <span className="flex shrink-0 items-center print:hidden">
                    <MoveButton direction="up" disabled={index === 0} onClick={() => move(index, -1)} />
                    <MoveButton direction="down" disabled={index === sortedItems.length - 1} onClick={() => move(index, 1)} />
                  </span>
                ) : (
                  // Spotify Mix: length on top, tempo and key as small badges underneath.
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-caption tabular-nums ${duration != null ? "text-text-muted" : "text-warning"}`}>
                      {duration != null ? formatRuntime(duration) : "시간 없음"}
                    </span>
                    {(song.tempo_bpm || key) && (
                      <span className="flex items-center gap-1">
                        {song.tempo_bpm ? (
                          <span className="rounded-md bg-surface-elevated px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-text-muted">
                            {song.tempo_bpm} BPM
                          </span>
                        ) : null}
                        {key && (
                          <span className="max-w-[4.5rem] truncate rounded-md bg-primary/15 px-1.5 text-[11px] font-semibold leading-5 text-primary">
                            {key}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
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
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-dashed border-warning/40 px-4 text-sm font-medium text-warning transition-colors hover:bg-warning-soft/30"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              인터벌 블록 추가
            </button>
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-surface-hover hover:text-primary disabled:opacity-40"
                >
                  {addingSongId === song.id ? (
                    <span className="h-4 w-4 animate-spin rounded-pill border-2 border-border-strong border-t-primary" />
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
