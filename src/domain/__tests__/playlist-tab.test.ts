import { describe, expect, it } from "vitest";
import { initialPlaylistTab } from "../playlist-tab";
import { fixtureItems } from "./setlist-fixture";

describe("initialPlaylistTab", () => {
  it.each([
    { case: "no tab opens 후보곡", tab: undefined, setlist: fixtureItems, expected: "playlist" },
    { case: "a setlist link opens the setlist", tab: "setlist", setlist: fixtureItems, expected: "setlist" },
    { case: "an empty setlist still opens its tab, which says it is empty", tab: "setlist", setlist: [], expected: "setlist" },
    { case: "a failed setlist read opens 후보곡, not a setlist that looks empty", tab: "setlist", setlist: null, expected: "playlist" },
    { case: "후보곡 by name", tab: "playlist", setlist: fixtureItems, expected: "playlist" },
    { case: "no link opens 합주", tab: "rehearsal", setlist: fixtureItems, expected: "playlist" },
    { case: "an unknown value", tab: "qDPJnh1d", setlist: fixtureItems, expected: "playlist" },
    { case: "an empty value", tab: "", setlist: fixtureItems, expected: "playlist" },
    { case: "the check is exact", tab: "Setlist", setlist: fixtureItems, expected: "playlist" },
    { case: "a repeated key", tab: ["setlist", "setlist"], setlist: fixtureItems, expected: "playlist" },
  ])("$case", ({ tab, setlist, expected }) => {
    expect(initialPlaylistTab(tab, setlist)).toBe(expected);
  });
});
