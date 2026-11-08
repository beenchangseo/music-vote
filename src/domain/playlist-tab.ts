// The tab /playlist/{shareCode} opens on. A link that says 셋리스트 has to open the 셋리스트 tab (#80).

import type { SetlistItem } from "./types";

/** Tabs a link can open. 합주 is not one: the page does not read its comments, so it would open empty. */
export type PlaylistLinkTab = "playlist" | "setlist";

export const PLAYLIST_TAB_PARAM = "tab";

/**
 * `?tab=` as the page receives it, and the setlist the page read (null when that read failed).
 * Anyone can edit the query, so anything but one exact "setlist" opens 후보곡. An empty setlist still opens its tab,
 * which says it is empty. A failed read opens 후보곡, because the setlist tab would show it as an empty setlist;
 * tapping 셋리스트 then loads it.
 */
export function initialPlaylistTab(tab: string | string[] | undefined, setlist: readonly SetlistItem[] | null): PlaylistLinkTab {
  return tab === "setlist" && setlist !== null ? "setlist" : "playlist";
}
