import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { GA_PAGES, gaCampaign, gaPage, gaReferrer, parseGaMeasurementId, UNKNOWN_GA_PAGE } from "../google-analytics";
import { kakaoShareQuery, SHARE_VARIANTS } from "../kakao-share";

const ORIGIN = "https://plypick.kr";
const APP_DIR = join(__dirname, "..", "..", "app");

function pageRoutes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : pageRoutes(path);
    if (entry.name !== "page.tsx") return [];
    const route = relative(APP_DIR, dir).split(sep).filter(Boolean).join("/");
    return [`/${route}`];
  });
}

describe("gaPage", () => {
  it.each([
    { url: "/", path: "/", title: "홈" },
    { url: "/about", path: "/about", title: "소개" },
    { url: "/guide", path: "/guide", title: "사용 가이드" },
    { url: "/new", path: "/new", title: "새 플레이리스트" },
    { url: "/privacy", path: "/privacy", title: "개인정보처리방침" },
    { url: "/terms", path: "/terms", title: "이용약관" },
    { url: "/support", path: "/support", title: "문의" },
    { url: "/design", path: "/design", title: "디자인 시스템" },
    { url: "/playlist/qDPJnh1d", path: "/playlist/[code]", title: "플레이리스트" },
    {
      url: "/playlist/qDPJnh1d?utm_source=kakao&utm_medium=share&utm_campaign=qDPJnh1d&variant=playlist",
      path: "/playlist/[code]",
      title: "플레이리스트",
    },
    {
      url: "/playlist/qDPJnh1d?utm_source=kakao&utm_medium=share&variant=setlist&tab=setlist",
      path: "/playlist/[code]",
      title: "플레이리스트",
    },
    { url: "/playlist/qDPJnh1d/metronome?bpm=120&songId=42", path: "/playlist/[code]/metronome", title: "메트로놈" },
    { url: "/band/0b6f1f0e-8c7e-4c1a-9d1f-3f2b1a7c9e10?created=1", path: "/band/[id]", title: "밴드 홈" },
    { url: "/join/Xy7Kp2Qa?join=1", path: "/join/[code]", title: "밴드 초대" },
    { url: "/lab/recording", path: "/lab/recording", title: "찾을 수 없는 페이지" },
    { url: "/?left=1", path: "/", title: "홈" },
    { url: "/about/", path: "/about", title: "소개" },
    { url: "/guide#faq", path: "/guide", title: "사용 가이드" },
    { url: "/qDPJnh1d", ...UNKNOWN_GA_PAGE },
    { url: "/playlist", ...UNKNOWN_GA_PAGE },
    { url: "/playlist/qDPJnh1d/settings", ...UNKNOWN_GA_PAGE },
    { url: "/join", ...UNKNOWN_GA_PAGE },
    { url: "/About", ...UNKNOWN_GA_PAGE },
    { url: "/api/setlist-pdf/qDPJnh1d", ...UNKNOWN_GA_PAGE },
  ])("$url → $path", ({ url, path, title }) => {
    expect(gaPage(url)).toEqual({ path, title });
  });

  it("knows every page under src/app, and nothing GA sees keeps a route param", () => {
    const routes = pageRoutes(APP_DIR);
    expect(routes).toContain("/playlist/[shareCode]/metronome");

    const seen = routes.map((route) => {
      const url = route.replace(/\[[^\]]+\]/g, "SECRET9z");
      const page = gaPage(url);
      expect(page, route).not.toEqual(UNKNOWN_GA_PAGE);
      expect(page.path + page.title, route).not.toContain("SECRET9z");
      return page.path;
    });

    // A table entry no page reaches is a renamed or deleted route.
    expect(new Set(seen)).toEqual(new Set(GA_PAGES.map((page) => page.path)));
  });
});

describe("gaReferrer", () => {
  it.each([
    { case: "no referrer", referrer: "", expected: undefined },
    { case: "a plypick page is masked", referrer: `${ORIGIN}/playlist/qDPJnh1d?utm_campaign=qDPJnh1d`, expected: `${ORIGIN}/playlist/[code]` },
    { case: "an invite page is masked", referrer: `${ORIGIN}/join/Xy7Kp2Qa`, expected: `${ORIGIN}/join/[code]` },
    { case: "a search engine keeps its host", referrer: "https://search.naver.com/search.naver?query=plypick", expected: "https://search.naver.com/" },
    {
      case: "a link shim loses the share code in its query",
      referrer: "https://l.facebook.com/l.php?u=https%3A%2F%2Fplypick.kr%2Fplaylist%2FqDPJnh1d",
      expected: "https://l.facebook.com/",
    },
    { case: "an Android app keeps its package", referrer: "android-app://com.kakao.talk/", expected: "android-app://com.kakao.talk/" },
    { case: "the www host is another origin", referrer: "https://www.plypick.kr/playlist/qDPJnh1d", expected: "https://www.plypick.kr/" },
    { case: "not a URL", referrer: "garbage", expected: undefined },
  ])("$case", ({ referrer, expected }) => {
    expect(gaReferrer(referrer, ORIGIN)).toBe(expected);
  });
});

describe("gaCampaign", () => {
  const KAKAO = { campaign_source: "kakao", campaign_medium: "share" };

  it.each(SHARE_VARIANTS)("reads back the %s share link a Kakao card carries", (variant) => {
    expect(gaCampaign(`?${kakaoShareQuery(variant)}`)).toEqual({ ...KAKAO, campaign_content: variant });
  });

  it.each([
    { case: "no query", search: "", expected: {} },
    {
      case: "an old share link drops its utm_campaign share code",
      search: "?utm_source=kakao&utm_medium=share&utm_campaign=qDPJnh1d&variant=playlist",
      expected: { ...KAKAO, campaign_content: "playlist" },
    },
    { case: "an old header share link had no variant", search: "?utm_source=kakao&utm_medium=share&utm_campaign=qDPJnh1d", expected: KAKAO },
    {
      case: "edited values go nowhere",
      search: "?utm_source=qDPJnh1d&utm_medium=%EB%B0%B4%EB%93%9C&variant=qDPJnh1d&utm_content=x&utm_term=y&utm_id=z",
      expected: {},
    },
    { case: "the check is exact", search: "?utm_source=Kakao&utm_medium=share%20&variant=PLAYLIST", expected: {} },
    { case: "the first of a repeated key decides", search: "?utm_source=qDPJnh1d&utm_source=kakao", expected: {} },
    { case: "each field stands alone", search: "?utm_medium=share&variant=band", expected: { campaign_medium: "share", campaign_content: "band" } },
    { case: "home is an OG image variant, not a share card", search: "?utm_source=kakao&variant=home", expected: { campaign_source: "kakao" } },
  ])("$case", ({ search, expected }) => {
    expect(gaCampaign(search)).toEqual(expected);
  });
});

describe("parseGaMeasurementId", () => {
  it.each([
    { raw: undefined, expected: null },
    { raw: "", expected: null },
    { raw: "G-TEST123456", expected: "G-TEST123456" },
    { raw: "G-TEST123456\n", expected: "G-TEST123456" },
    { raw: "UA-12345-1", expected: null },
    { raw: "G-", expected: null },
    { raw: "g-test123456", expected: null },
    { raw: "G-TEST123456&foo=1", expected: null },
    { raw: 'G-1"><script>', expected: null },
  ])("$raw → $expected", ({ raw, expected }) => {
    expect(parseGaMeasurementId(raw)).toBe(expected);
  });
});
