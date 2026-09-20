import { describe, expect, it } from "vitest";
import { cumulativeStarts, effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, summarizeSetlist } from "../setlist-domain";
import type { SetlistItem, SongWithScore } from "../types";

const song = { id: "song-1", title: "원본 제목", duration_seconds: 180 } as SongWithScore;
const base = { id: "item-1", playlist_id: "p", position: 0, item_type: "song", song_id: song.id, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" } as SetlistItem;

describe("setlist domain", () => {
  it("uses overrides without changing the source song", () => {
    const item = { ...base, title_override: "공연용 제목", duration_override_seconds: 200 };
    expect(effectiveSetlistTitle(item, song)).toBe("공연용 제목");
    expect(effectiveSetlistDuration(item, song)).toBe(200);
    expect(song.title).toBe("원본 제목");
  });

  it("counts only song blocks and includes interval time", () => {
    const items: SetlistItem[] = [
      base,
      { ...base, id: "interval", item_type: "interval", song_id: null, label: "멘트", duration_seconds: 30 },
      { ...base, id: "missing", song_id: "song-2" },
    ];
    expect(summarizeSetlist(items, [song, { id: "song-2", duration_seconds: null }])).toEqual({ songCount: 2, totalRuntime: 210, missingDurationCount: 1 });
  });

  it("formats totals over an hour", () => expect(formatRuntime(3723)).toBe("1:02:03"));
});

describe("cumulativeStarts", () => {
  const song = (id: string, duration_seconds: number | null) => ({ id, duration_seconds });
  const item = (
    id: string,
    item_type: "song" | "interval",
    extra: Partial<SetlistItem> = {},
  ) => ({
    id,
    playlist_id: "p",
    position: 0,
    item_type,
    song_id: item_type === "song" ? id : null,
    label: null,
    description: null,
    duration_seconds: 0,
    title_override: null,
    duration_override_seconds: null,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  }) as SetlistItem;

  it("앞선 항목들의 길이를 누적한다", () => {
    const items = [item("a", "song"), item("b", "song"), item("c", "song")];
    const songs = [song("a", 225), song("b", 209), song("c", 275)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 225, 434]);
  });

  it("인터벌 시간도 누적에 넣는다", () => {
    const items = [
      item("a", "song"),
      item("i", "interval", { duration_seconds: 300 }),
      item("b", "song"),
    ];
    const songs = [song("a", 200), song("b", 100)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 200, 500]);
  });

  it("시간을 모르는 곡은 0으로 세고 이후 누적이 어긋난다", () => {
    const items = [item("a", "song"), item("b", "song"), item("c", "song")];
    const songs = [song("a", 100), song("b", null), song("c", 50)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 100, 100]);
  });

  it("셋리스트 전용 시간이 원본보다 우선한다", () => {
    const items = [item("a", "song", { duration_override_seconds: 60 }), item("b", "song")];
    const songs = [song("a", 300), song("b", 100)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 60]);
  });

  it("빈 셋리스트를 견딘다", () => {
    expect(cumulativeStarts([], [])).toEqual([]);
  });
});
