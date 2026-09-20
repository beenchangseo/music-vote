import type { SetlistItem, SongWithScore } from "./types";

export function effectiveSetlistTitle(
  item: SetlistItem,
  song: Pick<SongWithScore, "title">,
): string {
  return item.title_override?.trim() || song.title;
}

export function effectiveSetlistDuration(
  item: SetlistItem,
  song: Pick<SongWithScore, "duration_seconds">,
): number | null {
  return item.duration_override_seconds ?? song.duration_seconds;
}

export function summarizeSetlist(
  items: SetlistItem[],
  songs: Pick<SongWithScore, "id" | "duration_seconds">[],
): { songCount: number; totalRuntime: number; missingDurationCount: number } {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  let songCount = 0;
  let totalRuntime = 0;
  let missingDurationCount = 0;

  for (const item of items) {
    if (item.item_type === "interval") {
      totalRuntime += Math.max(0, item.duration_seconds || 0);
      continue;
    }

    if (!item.song_id) continue;
    const song = songMap.get(item.song_id);
    if (!song) continue;
    songCount += 1;
    const duration = effectiveSetlistDuration(item, song);
    if (duration == null) {
      missingDurationCount += 1;
    } else {
      totalRuntime += Math.max(0, duration);
    }
  }

  return { songCount, totalRuntime, missingDurationCount };
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
  items: SetlistItem[],
  songs: Pick<SongWithScore, "id" | "duration_seconds">[],
): number[] {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  let elapsed = 0;

  return items.map((item) => {
    const start = elapsed;
    if (item.item_type === "interval") {
      elapsed += Math.max(0, item.duration_seconds || 0);
      return start;
    }
    const song = item.song_id ? songMap.get(item.song_id) : null;
    if (song) elapsed += effectiveSetlistDuration(item, song) ?? 0;
    return start;
  });
}
