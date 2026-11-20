// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useEffect, type ComponentType, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
// The real next/script injects its <script> from a mount effect and loads a src once per module. The stand-in records
// what was already queued at that moment, which is what gtm.js reads first when it arrives.
const scriptLoads = vi.hoisted(() => [] as { src: string; queued: unknown[] }[]);
vi.mock("next/script", async () => {
  const { useEffect } = await import("react");
  return {
    default: function Script({ src }: { src: string }) {
      useEffect(() => {
        scriptLoads.push({ src, queued: [...(window.dataLayer ?? [])] });
      }, [src]);
      return <i data-script-src={src} />;
    },
  };
});

const ID = "GTM-TEST123";
const GTM_SRC = `https://www.googletagmanager.com/gtm.js?id=${ID}`;
const ORIGIN = window.location.origin;

type Push = Record<string, unknown>;

// Fresh modules per test: GoogleTagManager remembers for the page's lifetime that it queued the container.
let GoogleTagManager: ComponentType;
let GaOptOutSwitch: ComponentType;
let track: typeof import("@/lib/analytics").track;
let setGaOptedOut: typeof import("@/lib/ga-opt-out").setGaOptedOut;
let isGaOptedOut: typeof import("@/lib/ga-opt-out").isGaOptedOut;

const reload = vi.fn();

function pushes(): Push[] {
  return (window.dataLayer ?? []) as Push[];
}

function containerStarts(queue: unknown[] = pushes()) {
  return (queue as Push[]).filter((push) => push.event === "gtm.js");
}

/** Every event GTM will see, with the data model it has merged by then. Top-level keys are all this app pushes. */
function events() {
  const seen: { event: unknown; model: Push }[] = [];
  let model: Push = {};
  for (const { event, ...fields } of pushes()) {
    model = { ...model, ...fields };
    if (event !== undefined) seen.push({ event, model });
  }
  return seen;
}

const PAGE_KEYS = ["page_location", "page_title", "page_referrer", "campaign_source", "campaign_medium", "campaign_content"];

function pageViews() {
  return events()
    .filter(({ event }) => event === "plypick_page_view")
    .map(({ model }) => Object.fromEntries(PAGE_KEYS.filter((key) => model[key] !== undefined).map((key) => [key, model[key]])));
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

beforeEach(async () => {
  vi.resetModules();
  ({ default: GoogleTagManager } = await import("../GoogleTagManager"));
  ({ default: GaOptOutSwitch } = await import("../GaOptOutSwitch"));
  ({ track } = await import("@/lib/analytics"));
  ({ setGaOptedOut, isGaOptedOut } = await import("@/lib/ga-opt-out"));
  delete window.dataLayer;
  scriptLoads.length = 0;
  reload.mockReset();
  window.localStorage.clear();
  document.querySelectorAll("script").forEach((script) => script.remove());
  setReferrer("");
  window.history.replaceState(null, "", "/");
  navigation.pathname = "/";
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GoogleTagManager env gate", () => {
  it.each([
    { case: "unset", value: undefined },
    { case: "empty", value: "" },
    { case: "a GA measurement id", value: "G-TEST123456" },
    { case: "markup", value: 'GTM-1"><script>' },
  ])("$case: no gtm.js and no dataLayer", ({ value }) => {
    if (value !== undefined) vi.stubEnv("NEXT_PUBLIC_GTM_ID", value);

    render(<GoogleTagManager />);

    expect(scriptLoads).toEqual([]);
    expect(window.dataLayer).toBeUndefined();
  });

  it("a container id starts GTM once, after this page's fields and before gtm.js loads", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", ` ${ID}\n`);
    navigation.pathname = "/band/team-1";
    const { rerender } = hydrate(<GoogleTagManager />);
    navigation.pathname = "/playlist/abcd1234";
    rerender(<GoogleTagManager />);

    expect(scriptLoads.map(({ src }) => src)).toEqual([GTM_SRC]);
    const [{ queued }] = scriptLoads;
    expect(containerStarts(queued)).toEqual([{ "gtm.start": expect.any(Number), event: "gtm.js" }]);
    // GTM fires Initialization (where the Google tag reads its page fields) before the first queued event.
    expect(queued[0]).toMatchObject({ page_location: `${ORIGIN}/band/[id]` });
    expect(queued.indexOf(containerStarts(queued)[0])).toBe(1);
    expect(containerStarts()).toHaveLength(1);
  });
});

describe("GoogleTagManager page views", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_GTM_ID", ID));

  it("a playlist page view carries the route template and fixed title, never the share code or query", () => {
    window.history.replaceState(null, "", "/playlist/abcd1234?utm_campaign=abcd1234&join=1");
    navigation.pathname = "/playlist/abcd1234";
    const { rerender } = render(<GoogleTagManager />);

    window.history.pushState(null, "", "/playlist/abcd1234/metronome?bpm=120&songId=42");
    navigation.pathname = "/playlist/abcd1234/metronome";
    rerender(<GoogleTagManager />);

    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/playlist/[code]`, page_title: "플레이리스트" },
      { page_location: `${ORIGIN}/playlist/[code]/metronome`, page_title: "메트로놈", page_referrer: `${ORIGIN}/playlist/[code]` },
    ]);
    const sent = JSON.stringify(pushes());
    for (const secret of ["abcd1234", "utm_", "?", "songId"]) expect(sent).not.toContain(secret);
  });

  it("another playlist is a new page view even though GA sees the same template", () => {
    navigation.pathname = "/playlist/aaaa1111";
    const { rerender } = render(<GoogleTagManager />);
    navigation.pathname = "/playlist/bbbb2222";
    rerender(<GoogleTagManager />);

    expect(pageViews()).toHaveLength(2);
  });

  it("a re-render on the same pathname (query-only change, Strict Mode) pushes nothing more", () => {
    navigation.pathname = "/band/team-1";
    window.history.replaceState(null, "", "/band/team-1?created=1");
    const { rerender } = render(
      <StrictMode>
        <GoogleTagManager />
      </StrictMode>,
    );
    const before = pushes().length;
    window.history.replaceState(null, "", "/band/team-1");
    rerender(
      <StrictMode>
        <GoogleTagManager />
      </StrictMode>,
    );

    expect(pushes()).toHaveLength(before);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/band/[id]`, page_title: "밴드 홈" }]);
    expect(containerStarts()).toHaveLength(1);
  });

  it.each([
    { case: "a plypick invite link is masked", referrer: `${ORIGIN}/join/Xy7Kp2Qa?join=1`, expected: `${ORIGIN}/join/[code]` },
    {
      case: "a link shim keeps only its host",
      referrer: "https://l.facebook.com/l.php?u=https%3A%2F%2Fplypick.kr%2Fplaylist%2Fabcd1234",
      expected: "https://l.facebook.com/",
    },
  ])("the landing referrer: $case", ({ referrer, expected }) => {
    setReferrer(referrer);
    navigation.pathname = "/playlist/abcd1234";

    render(<GoogleTagManager />);

    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/playlist/[code]`, page_title: "플레이리스트", page_referrer: expected }]);
    const sent = JSON.stringify(pushes());
    for (const secret of ["abcd1234", "Xy7Kp2Qa", "l.php"]) expect(sent).not.toContain(secret);
  });

  it("a direct visit pushes page_referrer as undefined, so no earlier value lingers in GTM's data model", () => {
    render(<GoogleTagManager />);

    expect(pushes()[0]).toEqual({ page_location: `${ORIGIN}/`, page_title: "홈", page_referrer: undefined });
    expect(Object.hasOwn(pushes()[0], "page_referrer")).toBe(true);
  });

  it("a Kakao share landing names kakao / share and the card, from fixed values only", () => {
    window.history.replaceState(null, "", "/playlist/abcd1234?utm_source=kakao&utm_medium=share&utm_campaign=abcd1234&variant=decided");
    navigation.pathname = "/playlist/abcd1234";

    render(<GoogleTagManager />);

    expect(pageViews()).toEqual([
      {
        page_location: `${ORIGIN}/playlist/[code]`,
        page_title: "플레이리스트",
        campaign_source: "kakao",
        campaign_medium: "share",
        campaign_content: "decided",
      },
    ]);
    expect(JSON.stringify(pushes())).not.toContain("abcd1234");
  });

  it("an edited share link pushes no campaign and none of its values", () => {
    window.history.replaceState(null, "", "/playlist/abcd1234?utm_source=evil9src&utm_medium=evil9med&utm_campaign=abcd1234&variant=evil9var");
    navigation.pathname = "/playlist/abcd1234";

    render(<GoogleTagManager />);

    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/playlist/[code]`, page_title: "플레이리스트" }]);
    const sent = JSON.stringify(pushes());
    for (const value of ["evil9", "abcd1234", "campaign"]) expect(sent).not.toContain(value);
  });

  it("only the landing page pushes campaign keys", () => {
    const { rerender } = render(<GoogleTagManager />);
    window.history.pushState(null, "", "/playlist/abcd1234?utm_source=kakao&utm_medium=share&variant=playlist");
    navigation.pathname = "/playlist/abcd1234";
    rerender(<GoogleTagManager />);

    expect(pageViews()).toHaveLength(2);
    expect(JSON.stringify(pushes())).not.toContain("campaign");
  });
});

describe("GoogleTagManager and a page's own mount-time track()", () => {
  it("pushes the event after the masked fields of its own page, on first load and after a client navigation", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", ID);
    // The page before GoogleTagManager: passive effects run in this order, children first.
    const tree = () => (
      <>
        <TracksOnMount key={navigation.pathname} />
        <GoogleTagManager />
      </>
    );
    navigation.pathname = "/band/team-1";
    const { rerender } = hydrate(tree());
    navigation.pathname = "/playlist/abcd1234";
    rerender(tree());

    expect(events().map(({ event, model }) => [event, model.page_location])).toEqual([
      ["gtm.js", `${ORIGIN}/band/[id]`],
      ["plypick_page_view", `${ORIGIN}/band/[id]`],
      ["band_home_viewed", `${ORIGIN}/band/[id]`],
      ["plypick_page_view", `${ORIGIN}/playlist/[code]`],
      ["band_home_viewed", `${ORIGIN}/playlist/[code]`],
    ]);
    const viewed = events().filter(({ event }) => event === "band_home_viewed");
    expect(viewed.map(({ model }) => model.event_params)).toEqual([{ role: "owner" }, { role: "owner" }]);
  });

  it("without a container id the event goes nowhere and nothing is queued", () => {
    render(
      <>
        <TracksOnMount />
        <GoogleTagManager />
      </>,
    );

    expect(window.dataLayer).toBeUndefined();
  });
});

describe("opting out on /privacy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", ID);
    vi.stubGlobal("location", { ...window.location, reload });
  });

  const sendSwitch = () => screen.getByRole("switch", { name: "Google 애널리틱스로 사용 통계 보내기" });
  const privacyPage = () => (
    <>
      <GaOptOutSwitch />
      <GoogleTagManager />
    </>
  );

  it("a visitor who opted out before gets no gtm.js and no dataLayer, and the page's own events go nowhere", () => {
    setGaOptedOut(true);
    navigation.pathname = "/band/team-1";

    hydrate(
      <>
        <TracksOnMount />
        <GoogleTagManager />
      </>,
    );

    expect(scriptLoads).toEqual([]);
    expect(window.dataLayer).toBeUndefined();
    expect(reload).not.toHaveBeenCalled();
  });

  it("turning the switch off once GTM loaded reloads the page once, and nothing more is pushed", () => {
    navigation.pathname = "/privacy";
    const { rerender } = render(privacyPage());
    expect(sendSwitch().getAttribute("aria-checked")).toBe("true");
    const before = pushes().length;

    fireEvent.click(sendSwitch());
    track("auth_logout", {});
    navigation.pathname = "/terms";
    rerender(privacyPage());

    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    // A loaded container keeps its own tags running; only a fresh page without gtm.js stops them.
    expect(reload).toHaveBeenCalledOnce();
    expect(pushes()).toHaveLength(before);
    expect(isGaOptedOut()).toBe(true);
  });

  it("turning it off before GTM ever loaded needs no reload", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    render(privacyPage());

    fireEvent.click(sendSwitch());

    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    expect(reload).not.toHaveBeenCalled();
  });

  it("turning it back on loads GTM without a reload and counts the page it is on; off again then reloads", () => {
    setGaOptedOut(true);
    navigation.pathname = "/privacy";
    render(privacyPage());
    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    expect(scriptLoads).toEqual([]);

    fireEvent.click(sendSwitch());

    expect(reload).not.toHaveBeenCalled();
    expect(scriptLoads.map(({ src }) => src)).toEqual([GTM_SRC]);
    expect(containerStarts(scriptLoads[0].queued)).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/privacy`, page_title: "개인정보처리방침" }]);

    fireEvent.click(sendSwitch());

    expect(reload).toHaveBeenCalledOnce();
  });

  it("another tab turning it off reloads this one too, since its loaded tags would keep sending", () => {
    navigation.pathname = "/playlist/abcd1234";
    render(<GoogleTagManager />);

    window.localStorage.setItem("plypick:ga-opt-out", "1");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "plypick:ga-opt-out", newValue: "1" }));
    });

    expect(reload).toHaveBeenCalledOnce();
  });

  it("the choice outlives the page", async () => {
    render(privacyPage());
    fireEvent.click(sendSwitch());

    vi.resetModules();
    const fresh = await import("@/lib/ga-opt-out");
    expect(fresh.isGaOptedOut()).toBe(true);
  });

  it("storage that refuses the choice still stops sending for this page, and does not reload it away", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    navigation.pathname = "/privacy";
    const { rerender } = render(privacyPage());
    const before = pushes().length;

    fireEvent.click(sendSwitch());
    track("auth_logout", {});
    navigation.pathname = "/terms";
    rerender(privacyPage());

    expect(sendSwitch().getAttribute("aria-checked")).toBe("false");
    // Only this page's memory holds the choice, so a reload would forget it and load GTM again.
    expect(reload).not.toHaveBeenCalled();
    expect(pushes()).toHaveLength(before);
  });
});
