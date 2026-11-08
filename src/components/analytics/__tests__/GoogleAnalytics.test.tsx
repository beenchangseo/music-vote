// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useEffect, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
// next/script loads a src once per module and remembers it, so a second test rendering it would show no script.
vi.mock("next/script", () => ({ default: ({ src }: { src: string }) => <i data-script-src={src} /> }));

import { track } from "@/lib/analytics";
import { setGaOptedOut } from "@/lib/ga-opt-out";
import GaOptOutSwitch from "../GaOptOutSwitch";
import GoogleAnalytics from "../GoogleAnalytics";

const ORIGIN = window.location.origin;

function gtagScripts() {
  return document.querySelectorAll('[data-script-src^="https://www.googletagmanager.com/gtag/js"]');
}

function commands(): unknown[][] {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry as IArguments));
}

/** Every event in the order gtag.js will send it, with the page fields `set` had given it by then. */
function sentEvents() {
  const sent: { name: unknown; params: unknown; fields: Record<string, unknown> }[] = [];
  let fields: Record<string, unknown> = {};
  for (const [command, ...args] of commands()) {
    if (command === "set") fields = { ...fields, ...(args[0] as Record<string, unknown>) };
    if (command === "event") sent.push({ name: args[0], params: args[1], fields });
  }
  return sent;
}

function pageViews() {
  return sentEvents()
    .filter((event) => event.name === "page_view")
    .map((event) => event.fields);
}

/** A full page load: the server's HTML, then hydration, where useSyncExternalStore still gives the server snapshot. */
function hydrate(ui: ReactElement) {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = renderToString(ui);
  return render(ui, { container, hydrate: true });
}

/** A page that reports itself from its mount effect, as BandHomeClient does with band_home_viewed. */
function TracksOnMount() {
  useEffect(() => {
    track("band_home_viewed", { role: "owner" });
  }, []);
  return null;
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}

beforeEach(() => {
  delete window.gtag;
  delete window.dataLayer;
  delete window["ga-disable-G-TEST123456"];
  window.localStorage.clear();
  setGaOptedOut(false);
  document.querySelectorAll("script").forEach((script) => script.remove());
  setReferrer("");
  window.history.replaceState(null, "", "/");
  navigation.pathname = "/";
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

    expect([...gtagScripts()].map((s) => s.getAttribute("data-script-src"))).toEqual([
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
    window.history.replaceState(null, "", "/playlist/qDPJnh1d?utm_campaign=qDPJnh1d&join=1");
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

  it("a Kakao share landing names kakao / share and the card, from fixed values only", () => {
    window.history.replaceState(null, "", "/playlist/qDPJnh1d?utm_source=kakao&utm_medium=share&utm_campaign=qDPJnh1d&variant=decided");
    navigation.pathname = "/playlist/qDPJnh1d";

    render(<GoogleAnalytics />);

    expect(pageViews()).toEqual([
      {
        page_location: `${ORIGIN}/playlist/[code]`,
        page_title: "플레이리스트",
        campaign_source: "kakao",
        campaign_medium: "share",
        campaign_content: "decided",
      },
    ]);
    expect(JSON.stringify(commands())).not.toContain("qDPJnh1d");
  });

  it("an edited share link sends no campaign and none of its values", () => {
    window.history.replaceState(null, "", "/playlist/qDPJnh1d?utm_source=evil9src&utm_medium=evil9med&utm_campaign=qDPJnh1d&variant=evil9var");
    navigation.pathname = "/playlist/qDPJnh1d";

    render(<GoogleAnalytics />);

    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/playlist/[code]`, page_title: "플레이리스트" }]);
    const sent = JSON.stringify(commands());
    for (const value of ["evil9", "qDPJnh1d", "campaign"]) expect(sent).not.toContain(value);
  });

  it("only the landing page reads the campaign", () => {
    navigation.pathname = "/";
    const { rerender } = render(<GoogleAnalytics />);
    window.history.pushState(null, "", "/playlist/qDPJnh1d?utm_source=kakao&utm_medium=share&variant=playlist");
    navigation.pathname = "/playlist/qDPJnh1d";
    rerender(<GoogleAnalytics />);

    expect(pageViews()).toHaveLength(2);
    expect(JSON.stringify(commands())).not.toContain("campaign");
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

describe("GoogleAnalytics and a page's own mount-time track()", () => {
  it("queues the event after the masked fields of its own page, on first load and after a client navigation", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456");
    // The page before GoogleAnalytics: passive effects run in this order, the order that dropped the event on first
    // load and stamped it with the previous page after a navigation.
    const tree = () => (
      <>
        <TracksOnMount key={navigation.pathname} />
        <GoogleAnalytics />
      </>
    );
    navigation.pathname = "/band/team-1";
    const { rerender } = hydrate(tree());
    navigation.pathname = "/playlist/qDPJnh1d";
    rerender(tree());

    expect(sentEvents().map(({ name, params, fields }) => [name, params, fields.page_location])).toEqual([
      ["page_view", undefined, `${ORIGIN}/band/[id]`],
      ["band_home_viewed", { role: "owner" }, `${ORIGIN}/band/[id]`],
      ["page_view", undefined, `${ORIGIN}/playlist/[code]`],
      ["band_home_viewed", { role: "owner" }, `${ORIGIN}/playlist/[code]`],
    ]);
  });

  it("without a measurement id the event goes nowhere and nothing is queued", () => {
    render(
      <>
        <TracksOnMount />
        <GoogleAnalytics />
      </>,
    );

    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("opting out on /privacy", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456"));

  const sendSwitch = () => screen.getByRole("switch", { name: "Google 애널리틱스로 사용 통계 보내기" });
  const privacyPage = () => (
    <>
      <GaOptOutSwitch />
      <GoogleAnalytics />
    </>
  );

  it("a visitor who opted out before gets no gtag.js and no queue, and the page's own events go nowhere", () => {
    setGaOptedOut(true);
    navigation.pathname = "/band/team-1";

    hydrate(
      <>
        <TracksOnMount />
        <GoogleAnalytics />
      </>,
    );

    expect(gtagScripts()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(window["ga-disable-G-TEST123456"]).toBe(true);
  });

  it("turning the switch off stops a tag that already runs, at once and on the next pages", () => {
    navigation.pathname = "/privacy";
    const { rerender } = render(privacyPage());
    expect(sendSwitch().getAttribute("aria-checked")).toBe("true");
    expect(window["ga-disable-G-TEST123456"]).toBe(false);

    fireEvent.click(sendSwitch());
    navigation.pathname = "/terms";
    rerender(privacyPage());

    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    // gtag.js reads this before every cookie and hit, user_engagement included.
    expect(window["ga-disable-G-TEST123456"]).toBe(true);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/privacy`, page_title: "개인정보처리방침" }]);
  });

  it("turning it back on loads GA and counts the page it is on", () => {
    setGaOptedOut(true);
    navigation.pathname = "/privacy";
    render(privacyPage());
    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    expect(gtagScripts()).toHaveLength(0);

    fireEvent.click(sendSwitch());

    expect(window["ga-disable-G-TEST123456"]).toBe(false);
    expect(gtagScripts()).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/privacy`, page_title: "개인정보처리방침" }]);
  });

  it("the choice outlives the page", async () => {
    render(privacyPage());
    fireEvent.click(sendSwitch());

    vi.resetModules();
    const { isGaOptedOut } = await import("@/lib/ga-opt-out");
    expect(isGaOptedOut()).toBe(true);
  });

  it("storage that refuses the choice still stops sending for this page", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(privacyPage());

    fireEvent.click(sendSwitch());

    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    expect(window["ga-disable-G-TEST123456"]).toBe(true);
  });
});
