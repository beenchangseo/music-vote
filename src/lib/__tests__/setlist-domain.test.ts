import { describe, expect, it } from "vitest";
import { effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, summarizeSetlist } from "../setlist-domain";
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
