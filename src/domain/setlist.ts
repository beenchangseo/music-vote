import type { SetlistEditMode, SetlistItem, SongWithScore } from "./types";

type RuntimeItem = Pick<SetlistItem, "item_type" | "song_id" | "duration_seconds" | "duration_override_seconds">;
type RuntimeSong = Pick<SongWithScore, "id" | "duration_seconds">;

export function effectiveSetlistTitle(
  item: Pick<SetlistItem, "title_override">,
  song: Pick<SongWithScore, "title">,
): string {
  return item.title_override?.trim() || song.title;
}

export function effectiveSetlistDuration(
  item: Pick<SetlistItem, "duration_override_seconds">,
  song: Pick<SongWithScore, "duration_seconds">,
): number | null {
  return item.duration_override_seconds ?? song.duration_seconds;
}

/**
 * 항목 하나가 공연 시간에 더하는 길이(초). 셋리스트·합주·내보내기의 시간은 모두 이 값을 더한다.
 * null 은 시간을 모르는 곡·자작곡이다. 총 시간에는 0으로 들어가고 `시간 미입력`으로 따로 센다.
 */
function itemRuntime(item: RuntimeItem, song: RuntimeSong | undefined): number | null {
  if (item.item_type === "song") {
    const duration = song ? effectiveSetlistDuration(item, song) : null;
    return duration == null ? null : Math.max(0, duration);
  }
  const duration = Math.max(0, item.duration_seconds || 0);
  return item.item_type === "original" && duration === 0 ? null : duration;
}

export function summarizeSetlist(
  items: RuntimeItem[],
  songs: RuntimeSong[],
): { songCount: number; totalRuntime: number; missingDurationCount: number } {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  let songCount = 0;
  let totalRuntime = 0;
  let missingDurationCount = 0;

  for (const item of items) {
    const song = item.song_id ? songMap.get(item.song_id) : undefined;
    if (item.item_type === "song" && !song) continue;
    const duration = itemRuntime(item, song);
    totalRuntime += duration ?? 0;
    if (item.item_type === "interval") continue;
    songCount += 1;
    if (duration == null) missingDurationCount += 1;
  }

  return { songCount, totalRuntime, missingDurationCount };
}

/**
 * 셋리스트를 들을 때의 재생 순서. 곡 블록만 담고 인터벌·자작곡은 건너뛴다.
 * 같은 곡이 두 번 들어 있으면 한 번만 넣는다. 재생 위치를 곡 id 로 찾으니 두 번 넣으면 "다음 곡"이 둘 사이를 돈다.
 */
export function setlistPlayOrder<S extends Pick<SongWithScore, "id">>(items: SetlistItem[], songs: S[]): S[] {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  const order = new Map<string, S>();
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const song = item.item_type === "song" && item.song_id ? songMap.get(item.song_id) : undefined;
    if (song && !order.has(song.id)) order.set(song.id, song);
  }
  return [...order.values()];
}

export function formatRuntime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * 각 항목이 시작하는 시각(초). 앞선 항목들의 길이를 누적한다.
 *
 * 공연 순서를 짤 때 알고 싶은 건 곡 길이가 아니라 "이 곡 시작할 때 몇 분 지났나"다.
 * 시간을 모르는 곡은 0으로 세고 이후 누적이 그만큼 어긋난다는 뜻이라,
 * 화면에서 `N곡 시간 미입력`을 함께 보여줘야 한다.
 */
export function cumulativeStarts(
  items: RuntimeItem[],
  songs: RuntimeSong[],
): number[] {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  let elapsed = 0;

  return items.map((item) => {
    const start = elapsed;
    elapsed += itemRuntime(item, item.song_id ? songMap.get(item.song_id) : undefined) ?? 0;
    return start;
  });
}

export type SetlistBlock<S> =
  | { kind: "song"; item: SetlistItem; song: S; start: number }
  | { kind: "original" | "interval"; item: SetlistItem; start: number };

export function setlistBlocks<S extends RuntimeSong>(items: SetlistItem[], songs: S[]): SetlistBlock<S>[] {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const starts = cumulativeStarts(sorted, songs);

  return sorted.flatMap((item, index): SetlistBlock<S>[] => {
    const start = starts[index];
    if (item.item_type !== "song") return [{ kind: item.item_type, item, start }];
    const song = item.song_id ? songMap.get(item.song_id) : undefined;
    return song ? [{ kind: "song", item, song, start }] : [];
  });
}

/**
 * 끈 블록을 놓은 블록 자리로 옮긴다. 그린 블록끼리만 순서를 바꾸고, 그리지 않은 블록은 제자리에 둔다.
 * 그리지 않은 블록이 지워진 곡만은 아니다. 실시간 재조회 중에는 다른 멤버가 막 넣은 곡 블록이 후보곡 목록보다 먼저
 * 도착해 잠깐 안 보인다. 그 사이 그 블록을 옮기면 모두의 셋리스트에서 자리가 바뀐다.
 * id 로 찾으니 끄는 사이 재조회로 목록이 바뀌어도 놓는 순간의 목록 기준이다. 옮길 게 없으면 null.
 * 서버의 reorder_setlist_items(v26)도 화면이 모르는 블록을 같은 규칙으로 제자리에 둔다.
 */
export function moveSetlistBlock(items: SetlistItem[], blocks: SetlistBlock<unknown>[], activeId: string, overId: string): SetlistItem[] | null {
  const drawn = blocks.map((block) => block.item);
  const from = drawn.findIndex((item) => item.id === activeId);
  const to = drawn.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return null;
  const [picked] = drawn.splice(from, 1);
  drawn.splice(to, 0, picked);
  const drawnIds = new Set(drawn.map((item) => item.id));
  let nextDrawn = 0;
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, position) => ({ ...(drawnIds.has(item.id) ? drawn[nextDrawn++] : item), position }));
}

/** 새 블록이 들어갈 자리: `before` 블록 바로 앞. null 은 맨 끝. */
export type SetlistSlot = { before: string | null };

/** 셋리스트에 새로 넣는 블록. 곡은 후보곡 id 만 보낸다. */
export type NewSetlistBlock =
  | { kind: "song"; songId: string }
  | { kind: "interval" | "original"; label: string; description: string; durationSeconds: number };

/** 편집 모드의 (+) 한 줄. 서버에 보낼 자리와, 시트가 보여 줄 바로 위 블록·시작 시각. */
export interface SetlistInsertSlot<S> {
  slot: SetlistSlot;
  after: SetlistBlock<S> | null;
  start: number;
}

/**
 * 블록마다 그 위에 (+) 하나, 맨 끝에 하나. 기준은 그린 블록뿐이라 숨은 블록은 넣을 자리의 기준이 되지 않는다.
 * 기준이 위치 숫자가 아니라 블록 id 라서, 그 사이 다른 멤버가 넣거나 옮겨도 "이 블록 앞"이 지켜진다.
 */
export function setlistInsertSlots<S>(blocks: SetlistBlock<S>[], totalRuntime: number): SetlistInsertSlot<S>[] {
  const slots = blocks.map((block, index) => ({ slot: { before: block.item.id }, after: blocks[index - 1] ?? null, start: block.start }));
  return [...slots, { slot: { before: null }, after: blocks[blocks.length - 1] ?? null, start: totalRuntime }];
}

export function setlistBlockTitle(block: SetlistBlock<Pick<SongWithScore, "title">>): string {
  if (block.kind === "song") return effectiveSetlistTitle(block.item, block.song);
  return block.item.label || (block.kind === "interval" ? "인터벌" : "자작곡");
}

export const BLOCK_LABEL_MAX = { interval: 50, original: 100 } as const;
export const BLOCK_DESCRIPTION_MAX = 200;

/** 인터벌·자작곡 입력 검사. 넣기와 고치기가 같이 쓴다. 어긋나면 null. */
export function parseBlockFields(
  kind: "interval" | "original",
  fields: { label: string; description: string; durationSeconds: number },
): { label: string; description: string | null; durationSeconds: number } | null {
  const label = fields.label.trim();
  const description = fields.description.trim();
  if (!label || label.length > BLOCK_LABEL_MAX[kind]) return null;
  if (description.length > BLOCK_DESCRIPTION_MAX) return null;
  if (!Number.isInteger(fields.durationSeconds) || fields.durationSeconds < 0) return null;
  return { label, description: description || null, durationSeconds: fields.durationSeconds };
}

type RowItem = RuntimeItem & Pick<SetlistItem, "label" | "description" | "title_override">;
type RowSong = RuntimeSong & Pick<SongWithScore, "title" | "artist" | "tempo_bpm">;

/** 내보내기(이미지·PDF)가 그리는 줄. 번호는 셋리스트 탭처럼 곡과 자작곡에만 붙는다. */
export type SetlistRow =
  | { kind: "song"; number: number; title: string; artist: string | null; bpm: number | null; duration: number | null }
  | { kind: "original"; number: number; title: string; description: string | null; duration: number | null }
  | { kind: "interval"; title: string; description: string | null; duration: number | null };

export function setlistRows(items: RowItem[], songs: RowSong[]): SetlistRow[] {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  let number = 0;

  return items.flatMap((item): SetlistRow[] => {
    if (item.item_type === "interval") {
      return [{ kind: "interval", title: item.label || "인터벌", description: item.description, duration: itemRuntime(item, undefined) }];
    }
    if (item.item_type === "original") {
      number += 1;
      return [{ kind: "original", number, title: item.label || "자작곡", description: item.description, duration: itemRuntime(item, undefined) }];
    }
    const song = item.song_id ? songMap.get(item.song_id) : undefined;
    if (!song) return [];
    number += 1;
    return [{
      kind: "song",
      number,
      title: effectiveSetlistTitle(item, song),
      artist: song.artist,
      bpm: song.tempo_bpm,
      duration: itemRuntime(item, song),
    }];
  });
}

export interface RehearsalInterval {
  id: string;
  title: string;
  duration: number;
}

export type RehearsalStep<S> = {
  id: string;
  title: string;
  duration: number | null;
  before: RehearsalInterval[];
  remaining: number;
} & ({ kind: "song"; song: S } | { kind: "original"; description: string | null });

export function rehearsalSteps<S extends RuntimeSong & Pick<SongWithScore, "title">>(
  items: SetlistItem[],
  songs: S[],
): { steps: RehearsalStep<S>[]; trailing: RehearsalInterval[] } {
  const { totalRuntime } = summarizeSetlist(items, songs);
  const steps: RehearsalStep<S>[] = [];
  let pending: RehearsalInterval[] = [];
  let previousEnd = 0;

  for (const block of setlistBlocks(items, songs)) {
    const { item } = block;
    const duration = itemRuntime(item, block.kind === "song" ? block.song : undefined);
    if (block.kind === "interval") {
      pending.push({ id: item.id, title: item.label || "인터벌", duration: duration ?? 0 });
      continue;
    }
    const base = { id: item.id, duration, before: pending, remaining: totalRuntime - previousEnd };
    steps.push(
      block.kind === "song"
        ? { ...base, kind: "song", song: block.song, title: effectiveSetlistTitle(item, block.song) }
        : { ...base, kind: "original", title: item.label || "자작곡", description: item.description },
    );
    pending = [];
    previousEnd = block.start + (duration ?? 0);
  }

  return { steps, trailing: pending };
}

export type SetlistEditAccess = "edit" | "locked_to_host" | "read_only";

export function setlistEditAccess(input: {
  archived: boolean;
  mode: SetlistEditMode;
  loggedIn: boolean;
  isHost: boolean;
}): SetlistEditAccess {
  if (input.archived || !input.loggedIn) return "read_only";
  if (input.mode === "host_only" && !input.isHost) return "locked_to_host";
  return "edit";
}
