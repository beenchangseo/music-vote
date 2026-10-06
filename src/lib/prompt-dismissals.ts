/**
 * "밴드 만들기" 안내 카드의 닫힘 기록 (디자인 DR6, eng Section 1 · O5).
 *
 * 플레이리스트 id 목록을 쿠키 하나에 둔다. 서버(홈 · 플레이리스트 페이지)가 읽어 카드를 처음부터 그리거나
 * 빼므로, 하이드레이션 뒤에 카드가 튀어나오거나 사라지지 않는다. 홈 카드와 플레이리스트 안 카드가 같은
 * 기록을 쓴다: 한쪽에서 닫으면 둘 다 사라진다(DR5).
 *
 * 값은 UUID 를 "." 로 이은 것(쿠키 값에 안전한 문자만), 최근 50개만 남긴다. httpOnly 가 아니다:
 * 닫기 버튼이 브라우저에서 바로 쓴다. 위조해도 자기 화면의 안내 카드만 바뀐다.
 */

export const BAND_PROMPT_COOKIE = "plypick_band_prompt_dismissed";
const MAX_DISMISSALS = 50;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 쿠키 전의 기록 (BandPromptCard 가 localStorage 에 남기던 키). 마운트 때 한 번 옮긴다. */
const legacyKey = (playlistId: string) => `plypick:band-prompt-dismissed:${playlistId}`;

/** 쿠키 값 → id 목록. 빈 값 · 깨진 값 · UUID 아닌 항목은 버린다. */
export function parseDismissals(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids = value.split(".").filter((id) => UUID.test(id));
  return [...new Set(ids)].slice(-MAX_DISMISSALS);
}

/** id 를 맨 뒤(가장 최근)에 더한다. 이미 있으면 뒤로 옮기고, 50개를 넘으면 오래된 것부터 버린다. */
export function addDismissal(ids: string[], playlistId: string): string[] {
  if (!UUID.test(playlistId)) return ids;
  return [...ids.filter((id) => id !== playlistId), playlistId].slice(-MAX_DISMISSALS);
}

export function serializeDismissals(ids: string[]): string {
  return ids.join(".");
}

// ============================================================
// 브라우저 전용 (닫기 버튼 · 마운트 때 확인)
// ============================================================

function readCookie(): string[] {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${BAND_PROMPT_COOKIE}=`));
  return parseDismissals(entry?.slice(BAND_PROMPT_COOKIE.length + 1));
}

function writeCookie(ids: string[]) {
  document.cookie =
    `${BAND_PROMPT_COOKIE}=${serializeDismissals(ids)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax` +
    (window.location.protocol === "https:" ? "; Secure" : "");
}

/** 닫기 버튼. 쿠키를 못 쓰는 브라우저면 조용히 넘어가고, 카드는 이번 화면에서만 닫힌다. */
export function dismissBandPrompt(playlistId: string): void {
  try {
    writeCookie(addDismissal(readCookie(), playlistId));
  } catch {
    // Closed for this visit only.
  }
}

/**
 * 브라우저에 이 플레이리스트의 닫힘 기록이 있는지 (읽기만). 서버가 본 쿠키가 낡았을 때(클라이언트 이동 캐시)와
 * 쿠키 전의 localStorage 기록을 함께 본다. 그 기록은 첫 방문에 카드가 한 번 그려졌다 사라진다(eng O5).
 */
export function hasBandPromptDismissal(playlistId: string): boolean {
  try {
    if (readCookie().includes(playlistId)) return true;
  } catch {
    // Cookies unreadable: fall through to the legacy record.
  }
  try {
    return window.localStorage.getItem(legacyKey(playlistId)) === "1";
  } catch {
    return false;
  }
}

/** 쿠키 전의 localStorage 기록을 쿠키로 옮기고 지운다(마운트 때 한 번). 없으면 아무것도 안 한다. */
export function migrateLegacyDismissal(playlistId: string): void {
  try {
    if (window.localStorage.getItem(legacyKey(playlistId)) !== "1") return;
    dismissBandPrompt(playlistId);
    window.localStorage.removeItem(legacyKey(playlistId));
  } catch {
    // Storage blocked: nothing to move.
  }
}
