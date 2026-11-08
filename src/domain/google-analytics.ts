// What Google Analytics is allowed to see of a page. Share codes, invite codes and team ids sit in the
// path, and document.title carries playlist titles, so GA gets a fixed template and title per route.

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

/** NEXT_PUBLIC_GA_ID as a measurement ID, or null when it is unset or not `G-` and alphanumerics. */
export function parseGaMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}
