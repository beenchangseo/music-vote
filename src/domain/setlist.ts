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
