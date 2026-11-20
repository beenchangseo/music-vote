// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const vercelTrack = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track: vercelTrack }));

import { track, type GaSafe } from "../analytics";
import { setGaOptedOut } from "../ga-opt-out";

beforeEach(() => {
  vercelTrack.mockReset();
  window.localStorage.clear();
  setGaOptedOut(false);
  // GoogleTagManager creates the queue when GTM may load; track() never does.
  window.dataLayer = [];
});

afterEach(() => {
  delete window.dataLayer;
});

describe("track", () => {
  it("sends the same event to GTM and Vercel, clearing the last event's params first", () => {
    track("vote_changed", { from: 1, to: -1 });

    expect(window.dataLayer).toEqual([
      { event_params: null },
      { event: "vote_changed", event_params: { from: 1, to: -1 } },
    ]);
    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("vote_changed", { from: 1, to: -1 });
  });

  it("clears before every event, so GTM's merged data model never lends one event's params to the next", () => {
    track("playlist_created", { has_deadline: true, setlist_count: 2 });
    track("song_meta_prefilled", {});

    expect(window.dataLayer).toEqual([
      { event_params: null },
      { event: "playlist_created", event_params: { has_deadline: true, setlist_count: 2 } },
      { event_params: null },
      { event: "song_meta_prefilled", event_params: {} },
    ]);
  });

  it("without a dataLayer (no container id, or opted out at load) only Vercel gets the event", () => {
    delete window.dataLayer;

    expect(() => track("setlist_exported", { format: "pdf" })).not.toThrow();

    expect(window.dataLayer).toBeUndefined();
    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("setlist_exported", { format: "pdf" });
  });

  it("opted out after GTM loaded: nothing more reaches the dataLayer", () => {
    setGaOptedOut(true);

    track("tap_tempo_used", { taps: 4 });

    expect(window.dataLayer).toEqual([]);
    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("tap_tempo_used", { taps: 4 });
  });

  it("a throwing dataLayer stays silent and Vercel still gets the event", () => {
    window.dataLayer = Object.assign([], {
      push: () => {
        throw new Error("gtm broke");
      },
    });

    expect(() => track("auth_logout", {})).not.toThrow();

    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("auth_logout", {});
  });

  it("a throwing Vercel track stays silent and GTM still gets the event", () => {
    vercelTrack.mockImplementation(() => {
      throw new Error("vercel broke");
    });

    expect(() => track("tap_tempo_used", { taps: 4 })).not.toThrow();

    expect(window.dataLayer).toEqual([{ event_params: null }, { event: "tap_tempo_used", event_params: { taps: 4 } }]);
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
