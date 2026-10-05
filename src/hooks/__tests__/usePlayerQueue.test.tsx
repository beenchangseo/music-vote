// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlayerQueue } from "../usePlayerQueue";
import type { SongWithScore } from "@/lib/types";

const songs = ["a", "b", "c"].map((id) => ({ id }) as SongWithScore);

describe("usePlayerQueue", () => {
  it("goes back to the previous song and wraps to the last from the first", () => {
    const { result } = renderHook(() => usePlayerQueue(songs));
    act(() => result.current.actions.playSong("b"));
    act(() => result.current.actions.playPrev());
    expect(result.current.state.currentSongId).toBe("a");
    act(() => result.current.actions.playPrev());
    expect(result.current.state.currentSongId).toBe("c");
    expect(result.current.state.isPlaying).toBe(true);
  });

  it("stays on the song when it ends with repeat-one, but a pressed next still moves on", () => {
    const { result } = renderHook(() => usePlayerQueue(songs));
    act(() => result.current.actions.playSong("a"));
    act(() => result.current.actions.toggleRepeat());

    // End of song: the caller reloads the same video, the queue does not move.
    act(() => result.current.actions.playNext());
    expect(result.current.state.currentSongId).toBe("a");

    // The listener pressed "다음 곡".
    act(() => result.current.actions.playNext(true));
    expect(result.current.state.currentSongId).toBe("b");
  });
});
