// What Google Analytics is allowed to see of a page. Share codes, invite codes and team ids sit in the
// path, and document.title carries playlist titles, so GA gets a fixed template and title per route.

import { isShareVariant, KAKAO_SHARE_MEDIUM, KAKAO_SHARE_SOURCE, type ShareVariant } from "./kakao-share";

export type GaPage = { path: string; title: string };

// One entry per page under src/app. A `[...]` segment matches any single path segment.
export const GA_PAGES: readonly GaPage[] = [
  { path: "/", title: "홈" },
  { path: "/about", title: "소개" },
  { path: "/guide", title: "사용 가이드" },
  { path: "/new", title: "새 플레이리스트" },
  { path: "/privacy", title: "개인정보처리방침" },
  { path: "/terms", title: "이용약관" },
  { path: "/support", title: "문의" },
  { path: "/design", title: "디자인 시스템" },
  { path: "/playlist/[code]", title: "플레이리스트" },
  { path: "/playlist/[code]/metronome", title: "메트로놈" },
  { path: "/band/[id]", title: "밴드 홈" },
  { path: "/join/[code]", title: "밴드 초대" },
];

export const UNKNOWN_GA_PAGE: GaPage = { path: "/(unknown)", title: "찾을 수 없는 페이지" };

function segments(path: string): string[] {
  return path.split(/[?#]/, 1)[0].split("/").filter(Boolean);
}

function matches(template: string[], actual: string[]): boolean {
  return (
    template.length === actual.length &&
    template.every((part, i) => part.startsWith("[") || part === actual[i])
  );
}

/** The route template and fixed title GA gets for a pathname. The query string and hash are dropped. */
export function gaPage(pathname: string): GaPage {
  const actual = segments(pathname);
  return GA_PAGES.find((route) => matches(segments(route.path), actual)) ?? UNKNOWN_GA_PAGE;
}

/**
 * page_referrer for GA. A plypick referrer is masked like a page. Any other referrer keeps only its scheme and host:
 * a link shim such as l.facebook.com/l.php?u=… can carry a share code in its query.
 */
export function gaReferrer(referrer: string, origin: string): string | undefined {
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return undefined;
  }
  if (url.origin === origin) return origin + gaPage(url.pathname).path;
  // android-app://com.kakao.talk/ has an opaque origin ("null"), so build the host form by hand.
  return `${url.protocol}//${url.host}/`;
}

/** Campaign fields for the landing page. They override the utm_ parameters GA can no longer read from page_location. */
export type GaCampaign = {
  campaign_source?: typeof KAKAO_SHARE_SOURCE;
  campaign_medium?: typeof KAKAO_SHARE_MEDIUM;
  campaign_content?: ShareVariant;
};

/**
 * Only the fixed values of a Kakao share link get through. Anyone can edit the query, so any other value is
 * dropped rather than forwarded, and utm_campaign never is: old share links put the share code there.
 */
export function gaCampaign(search: string): GaCampaign {
  const query = new URLSearchParams(search);
  const variant = query.get("variant");
  return {
    ...(query.get("utm_source") === KAKAO_SHARE_SOURCE && { campaign_source: KAKAO_SHARE_SOURCE }),
    ...(query.get("utm_medium") === KAKAO_SHARE_MEDIUM && { campaign_medium: KAKAO_SHARE_MEDIUM }),
    ...(isShareVariant(variant) && { campaign_content: variant }),
  };
}

/** NEXT_PUBLIC_GA_ID as a measurement ID, or null when it is unset or not `G-` and alphanumerics. */
export function parseGaMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}
