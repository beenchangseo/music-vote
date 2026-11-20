// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const vercelTrack = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track: vercelTrack }));

import { track, type GaSafe } from "../analytics";

beforeEach(() => {
  vercelTrack.mockReset();
  // GoogleTagManager creates the queue when GTM may load.
  window.dataLayer = [];
});

afterEach(() => {
  delete window.dataLayer;
});

describe("track", () => {
  it("sends the event to Vercel only: GTM tags are set up in the GTM console, not fed by app events", () => {
    track("vote_changed", { from: 1, to: -1 });

    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("vote_changed", { from: 1, to: -1 });
    expect(window.dataLayer).toEqual([]);
  });

  it("a throwing Vercel track stays silent", () => {
    vercelTrack.mockImplementation(() => {
      throw new Error("vercel broke");
    });

    expect(() => track("tap_tempo_used", { taps: 4 })).not.toThrow();
  });
});

describe("EventMap properties (checked by tsc in npm run check)", () => {
  it("a plain string property does not compile: it could carry a share code or what someone typed to Google", () => {
    // @ts-expect-error string is not a fixed set of values
    expectTypeOf<GaSafe<{ song_searched: { query: string } }>>().toBeObject();
    // @ts-expect-error a union that includes string is still any string
    expectTypeOf<GaSafe<{ song_searched: { source: "search" | string } }>>().toBeObject();
  });

  it("booleans, numbers and fixed strings compile", () => {
    expectTypeOf<GaSafe<{ song_searched: { from_history: boolean; results: number; source: "search" | "link" } }>>().toBeObject();
  });
});
