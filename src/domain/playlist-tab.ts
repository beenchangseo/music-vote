// The tab /playlist/{shareCode} opens on. A link that says 셋리스트 has to open the 셋리스트 tab (#80).

import type { SetlistItem } from "./types";

/** Tabs a link can open: every tab. 합주 loads its comments when it opens, the same way a tap on it does. */
export type PlaylistLinkTab = "playlist" | "setlist" | "rehearsal";

export const PLAYLIST_TAB_PARAM = "tab";

/**
 * `?tab=` as the page receives it, and the setlist the page read (null when that read failed).
 * Anyone can edit the query, so anything but one exact "setlist" or "rehearsal" opens 후보곡. An empty setlist still
 * opens its tab, which says it is empty. 셋리스트 and 합주 both list the setlist, so a failed read opens 후보곡: either
 * tab would show it as an empty setlist. Tapping the tab then loads it.
 */
export function initialPlaylistTab(tab: string | string[] | undefined, setlist: readonly SetlistItem[] | null): PlaylistLinkTab {
  return (tab === "setlist" || tab === "rehearsal") && setlist !== null ? tab : "playlist";
}
