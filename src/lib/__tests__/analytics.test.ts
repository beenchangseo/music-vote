// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vercelTrack = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track: vercelTrack }));

import { track } from "../analytics";

beforeEach(() => {
  vercelTrack.mockReset();
  delete window.gtag;
});

afterEach(() => {
  delete window.gtag;
});

describe("track", () => {
  it("sends the same event name and properties to GA and Vercel", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    track("vote_changed", { from: 1, to: -1 });

    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "vote_changed", { from: 1, to: -1 });
    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("vote_changed", { from: 1, to: -1 });
  });

  it("without gtag (GA off, or before it loads) only Vercel gets the event", () => {
    expect(() => track("setlist_exported", { format: "pdf" })).not.toThrow();

    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("setlist_exported", { format: "pdf" });
  });

  it("a throwing gtag stays silent and Vercel still gets the event", () => {
    window.gtag = () => {
      throw new Error("gtag broke");
    };

    expect(() => track("auth_logout", {})).not.toThrow();

    expect(vercelTrack).toHaveBeenCalledExactlyOnceWith("auth_logout", {});
  });

  it("a throwing Vercel track stays silent and GA still gets the event", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    vercelTrack.mockImplementation(() => {
      throw new Error("vercel broke");
    });

    expect(() => track("tap_tempo_used", { taps: 4 })).not.toThrow();

    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "tap_tempo_used", { taps: 4 });
  });
});
