import { describe, expect, it } from "vitest";
import { addTap, bpmFromTaps, MAX_BPM, MIN_BPM, TAP_RESET_MS } from "../tap-tempo";

/** Taps at a fixed interval, starting at 1000ms. */
const evenTaps = (count: number, intervalMs: number) =>
  Array.from({ length: count }, (_, i) => 1000 + i * intervalMs);

describe("bpmFromTaps", () => {
  it("reads 4 even taps as their tempo", () => {
    expect(bpmFromTaps(evenTaps(4, 500))).toBe(120);
    expect(bpmFromTaps(evenTaps(4, 600))).toBe(100);
  });

  it("rounds a slightly uneven hand to the nearest BPM", () => {
    expect(bpmFromTaps([0, 498, 1003, 1499, 2001])).toBe(120);
  });

  it("returns null with fewer than 2 taps", () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([1000])).toBeNull();
  });

  it("clamps a tempo outside the range the songs table accepts", () => {
    // 100ms apart = 600 BPM, 1900ms apart = ~32 BPM.
    expect(bpmFromTaps(evenTaps(4, 100))).toBe(MAX_BPM);
    expect(bpmFromTaps(evenTaps(4, 1900))).toBe(MIN_BPM);
  });

  it("ignores a missed beat among steady taps", () => {
    // The 1100ms gap is a hesitation, not a tempo change.
    expect(bpmFromTaps([0, 500, 1000, 1500, 2600, 3100])).toBe(120);
  });

  it("ignores a too-short interval among steady taps", () => {
    expect(bpmFromTaps([0, 500, 1000, 1500, 1600, 2100, 2600])).toBe(120);
  });
});

describe("addTap", () => {
  it("starts a new sequence after a long pause", () => {
    const taps = evenTaps(4, 500);
    const last = taps[taps.length - 1];
    expect(addTap(taps, last + TAP_RESET_MS + 1)).toEqual([last + TAP_RESET_MS + 1]);
  });

  it("keeps only the most recent taps", () => {
    let taps: number[] = [];
    for (const t of evenTaps(12, 500)) taps = addTap(taps, t);
    expect(taps).toHaveLength(8);
    expect(taps[0]).toBe(1000 + 4 * 500);
  });

  it("ignores a tap that does not move time forward", () => {
    expect(addTap([1000, 1500], 1500)).toEqual([1000, 1500]);
  });
});
