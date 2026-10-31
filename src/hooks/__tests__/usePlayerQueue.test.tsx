// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlayerQueue } from "../usePlayerQueue";
import type { SetlistItem, SongWithScore } from "@/domain/types";

const songs = ["a", "b", "c"].map((id) => ({ id }) as SongWithScore);

function item(id: string, position: number, fields: Partial<SetlistItem>): SetlistItem {
  return { id, position, item_type: "song", song_id: null, ...fields } as SetlistItem;
}

// Stored out of order on purpose: the queue follows position, not array order.
const setlist: SetlistItem[] = [
  item("i-a", 4, { song_id: "a" }),
  item("i-break", 0, { item_type: "interval", label: "멘트" }),
  item("i-c", 1, { song_id: "c" }),
  item("i-original", 2, { item_type: "original", label: "자작곡" }),
  item("i-deleted", 3, { song_id: "gone" }),
];

describe("usePlayerQueue", () => {
  it("goes back to the previous song and wraps to the last from the first", () => {
    const { result } = renderHook(() => usePlayerQueue(songs, null));
    act(() => result.current.actions.playSong("b"));
    act(() => result.current.actions.playPrev());
    expect(result.current.state.currentSongId).toBe("a");
    act(() => result.current.actions.playPrev());
    expect(result.current.state.currentSongId).toBe("c");
    expect(result.current.state.isPlaying).toBe(true);
  });

  it("stays on the song when it ends with repeat-one, but a pressed next still moves on", () => {
    const { result } = renderHook(() => usePlayerQueue(songs, null));
    act(() => result.current.actions.playSong("a"));
    act(() => result.current.actions.toggleRepeat());

    // End of song: the caller reloads the same video, the queue does not move.
    act(() => result.current.actions.playNext());
    expect(result.current.state.currentSongId).toBe("a");

    // The listener pressed "다음 곡".
    act(() => result.current.actions.playNext(true));
    expect(result.current.state.currentSongId).toBe("b");
  });

  it("plays the setlist's songs in setlist order, skipping intervals, originals and deleted songs", () => {
    const { result } = renderHook(() => usePlayerQueue(songs, setlist));
    act(() => result.current.actions.playSong("c", "setlist"));
    expect(result.current.state.source).toBe("setlist");
    expect(result.current.state.queue.map((song) => song.id)).toEqual(["c", "a"]);

    act(() => result.current.actions.playNext(true));
    expect(result.current.state.currentSongId).toBe("a");
    act(() => result.current.actions.playNext(true));
    expect(result.current.state.currentSongId).toBe("c");
    act(() => result.current.actions.playPrev());
    expect(result.current.state.currentSongId).toBe("a");
  });

  it("keeps candidate order for playback started from the candidates, even with a setlist", () => {
    const { result } = renderHook(() => usePlayerQueue(songs, setlist));
    act(() => result.current.actions.playSong("a", "candidates"));
    expect(result.current.state.source).toBe("candidates");

    act(() => result.current.actions.playNext());
    expect(result.current.state.currentSongId).toBe("b");
  });

  it("stays in the setlist queue when a song is picked from the player's up-next list", () => {
    const { result } = renderHook(() => usePlayerQueue(songs, setlist));
    act(() => result.current.actions.playSong("c", "setlist"));
    act(() => result.current.actions.playSong("a"));

    act(() => result.current.actions.playNext());
    expect(result.current.state.currentSongId).toBe("c");
  });

  it("keeps playing a song taken out of the setlist, then goes on from the setlist's first song", () => {
    const { result, rerender } = renderHook(({ items }) => usePlayerQueue(songs, items), { initialProps: { items: setlist } });
    act(() => result.current.actions.playSong("a", "setlist"));

    rerender({ items: setlist.filter((entry) => entry.song_id !== "a") });
    expect(result.current.state.currentSong?.id).toBe("a");

    act(() => result.current.actions.playNext());
    expect(result.current.state.currentSongId).toBe("c");
  });
});
