import { describe, expect, it } from "vitest";
import { PLAYLIST_STAGE_LABEL, isSetlistBlock, playlistStage } from "../playlist-stage";

describe("playlistStage", () => {
  it.each([
    ["nothing in the setlist yet", { setlistConfirmed: false, setlistBlockCount: 0 }, "voting", "투표 중"],
    ["blocks moved into the setlist, not confirmed", { setlistConfirmed: false, setlistBlockCount: 8 }, "building", "셋리스트 짜는 중"],
    ["a confirmed setlist", { setlistConfirmed: true, setlistBlockCount: 8 }, "confirmed", "셋리스트 확정"],
    // The cron marks an expired playlist with no songs confirmed only to take it off its queue.
    ["a confirm flag on an empty setlist", { setlistConfirmed: true, setlistBlockCount: 0 }, "closed", "마감"],
  ] as const)("reads %s as %s (%s)", (_case, facts, stage, label) => {
    expect(playlistStage(facts)).toBe(stage);
    expect(PLAYLIST_STAGE_LABEL[playlistStage(facts)]).toBe(label);
  });
});

describe("isSetlistBlock", () => {
  it.each([
    ["a song block", { item_type: "song", song_id: "s1" }, true],
    ["an original (자작곡) block", { item_type: "original", song_id: null }, true],
    ["an interval", { item_type: "interval", song_id: null }, false],
    ["a song block whose song was deleted (song_id SET NULL)", { item_type: "song", song_id: null }, false],
  ] as const)("counts %s: %s", (_case, item, counted) => {
    expect(isSetlistBlock(item)).toBe(counted);
  });
});
