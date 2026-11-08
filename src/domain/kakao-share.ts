// The query a Kakao share link carries. The landing page reads the same values back for GA (gaCampaign).

import { PLAYLIST_TAB_PARAM } from "./playlist-tab";

export const SHARE_VARIANTS = ["playlist", "decided", "setlist", "band"] as const;
export type ShareVariant = (typeof SHARE_VARIANTS)[number];

export const KAKAO_SHARE_SOURCE = "kakao";
export const KAKAO_SHARE_MEDIUM = "share";

export function isShareVariant(value: string | null): value is ShareVariant {
  return SHARE_VARIANTS.some((variant) => variant === value);
}

/** No utm_campaign: the share code it used to carry is already in the path, and GA must never get it. */
export function kakaoShareQuery(variant: ShareVariant): string {
  const query = new URLSearchParams({ utm_source: KAKAO_SHARE_SOURCE, utm_medium: KAKAO_SHARE_MEDIUM, variant });
  // The setlist card's button says 셋리스트 보기.
  if (variant === "setlist") query.set(PLAYLIST_TAB_PARAM, "setlist");
  return query.toString();
}
