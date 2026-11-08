// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import GoogleAnalytics from "../GoogleAnalytics";

const ORIGIN = window.location.origin;

function gtagScripts() {
  return document.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]');
}

function commands(): unknown[][] {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry as IArguments));
}

function pageViews() {
  const sent: Record<string, unknown>[] = [];
  let fields: Record<string, unknown> = {};
  for (const [command, ...args] of commands()) {
    if (command === "set") fields = { ...fields, ...(args[0] as Record<string, unknown>) };
    if (command === "event" && args[0] === "page_view") sent.push(fields);
  }
  return sent;
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}

beforeEach(() => {
  delete window.gtag;
  delete window.dataLayer;
  document.querySelectorAll("script").forEach((script) => script.remove());
  setReferrer("");
  navigation.pathname = "/";
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("GoogleAnalytics env gate", () => {
  it.each([
    { case: "unset", value: undefined },
    { case: "empty", value: "" },
    { case: "a Universal Analytics id", value: "UA-12345-1" },
    { case: "markup", value: 'G-1"><script>' },
  ])("$case: no gtag script and nothing queued", ({ value }) => {
    if (value !== undefined) vi.stubEnv("NEXT_PUBLIC_GA_ID", value);

    render(<GoogleAnalytics />);

    expect(gtagScripts()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it("a measurement id loads gtag.js for that id with ad features off and no automatic page view", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456");

    render(<GoogleAnalytics />);

    expect([...gtagScripts()].map((s) => s.getAttribute("src"))).toEqual([
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123456",
    ]);
    expect(commands()).toContainEqual([
      "config",
      "G-TEST123456",
      { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false },
    ]);
    // gtag.js ignores dataLayer entries that are not Arguments objects.
    for (const entry of window.dataLayer ?? []) {
      expect(Object.prototype.toString.call(entry)).toBe("[object Arguments]");
    }
  });
});

describe("GoogleAnalytics page views", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456"));

  it("first load and each client navigation send one masked page view, never the share code or query", () => {
    window.history.replaceState(null, "", "/playlist/qDPJnh1d?utm_campaign=qDPJnh1d&variant=playlist");
    setReferrer(`${ORIGIN}/join/Xy7Kp2Qa?join=1`);
    navigation.pathname = "/playlist/qDPJnh1d";
    const { rerender } = render(<GoogleAnalytics />);

    window.history.pushState(null, "", "/playlist/qDPJnh1d/metronome?bpm=120&songId=42");
    navigation.pathname = "/playlist/qDPJnh1d/metronome";
    rerender(<GoogleAnalytics />);

    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/playlist/[code]`, page_title: "플레이리스트", page_referrer: `${ORIGIN}/join/[code]` },
      {
        page_location: `${ORIGIN}/playlist/[code]/metronome`,
        page_title: "메트로놈",
        page_referrer: `${ORIGIN}/playlist/[code]`,
      },
    ]);
    const sent = JSON.stringify(commands());
    for (const secret of ["qDPJnh1d", "Xy7Kp2Qa", "utm_", "?", "songId"]) expect(sent).not.toContain(secret);
  });

  it("a direct visit sends no referrer", () => {
    render(<GoogleAnalytics />);

    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_title: "홈" }]);
  });

  it("an external referrer keeps only its host", () => {
    setReferrer("https://l.facebook.com/l.php?u=https%3A%2F%2Fplypick.kr%2Fplaylist%2FqDPJnh1d");

    render(<GoogleAnalytics />);

    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_title: "홈", page_referrer: "https://l.facebook.com/" }]);
  });

  it("another playlist is a new page view even though GA sees the same template", () => {
    navigation.pathname = "/playlist/aaaa1111";
    const { rerender } = render(<GoogleAnalytics />);
    navigation.pathname = "/playlist/bbbb2222";
    rerender(<GoogleAnalytics />);

    expect(pageViews()).toHaveLength(2);
  });

  it("a re-render on the same pathname (query-only change, Strict Mode) sends nothing more", () => {
    navigation.pathname = "/band/team-1";
    const { rerender } = render(
      <StrictMode>
        <GoogleAnalytics />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <GoogleAnalytics />
      </StrictMode>,
    );

    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/band/[id]`, page_title: "밴드 홈" }]);
    expect(commands().filter(([command]) => command === "config")).toHaveLength(1);
  });
});
