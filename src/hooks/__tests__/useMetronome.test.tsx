// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetronome } from "../useMetronome";

let audioTime = 0;

beforeEach(() => {
  audioTime = 0;
  vi.useFakeTimers();
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      get currentTime() {
        return audioTime;
      }
      destination = {};
      resume() {}
      close() {}
      createOscillator() {
        return { connect() {}, frequency: {}, start() {}, stop() {} };
      }
      createGain() {
        return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const BEAT_MS_AT_120_BPM = 500;
const BOOKED_AHEAD_MS = 100;

function advanceAudioAndTimersTickByTick(ms: number) {
  act(() => {
    for (let elapsed = 0; elapsed < ms; elapsed += 25) {
      audioTime += 0.025;
      vi.advanceTimersByTime(25);
    }
  });
}

function playingWithSecondBeatBooked() {
  const hook = renderHook(({ bpm }) => useMetronome(bpm), { initialProps: { bpm: 120 as number | null } });
  act(() => hook.result.current.start());
  advanceAudioAndTimersTickByTick(BEAT_MS_AT_120_BPM - BOOKED_AHEAD_MS / 2);
  return hook;
}

describe("useMetronome", () => {
  it("starts again on the first beat when it is stopped just before a beat", () => {
    const { result } = playingWithSecondBeatBooked();

    act(() => result.current.stop());
    act(() => result.current.start());
    advanceAudioAndTimersTickByTick(BOOKED_AHEAD_MS);

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.beat).toBe(0);
  });

  it.each([
    ["stopped", (hook: ReturnType<typeof playingWithSecondBeatBooked>) => act(() => hook.result.current.stop())],
    ["left without a BPM", (hook: ReturnType<typeof playingWithSecondBeatBooked>) => hook.rerender({ bpm: null })],
    ["unmounted", (hook: ReturnType<typeof playingWithSecondBeatBooked>) => hook.unmount()],
  ])("leaves no timer behind once it is %s mid-bar", (_, end) => {
    const hook = playingWithSecondBeatBooked();
    end(hook);
    expect(vi.getTimerCount()).toBe(0);
  });
});
