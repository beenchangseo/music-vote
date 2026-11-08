import { describe, expect, it } from "vitest";
import { PLAYLIST_STAGE_LABEL, playlistStage } from "../playlist-stage";

describe("playlistStage", () => {
  it.each([
    ["nothing in the setlist yet", { setlistConfirmed: false, setlistCount: 0 }, "voting", "투표 중"],
    ["songs moved into the setlist, not confirmed", { setlistConfirmed: false, setlistCount: 8 }, "building", "셋리스트 짜는 중"],
    ["a confirmed setlist", { setlistConfirmed: true, setlistCount: 8 }, "confirmed", "셋리스트 확정"],
    ["a confirmed setlist emptied afterwards", { setlistConfirmed: true, setlistCount: 0 }, "confirmed", "셋리스트 확정"],
  ] as const)("reads %s as %s (%s)", (_case, facts, stage, label) => {
    expect(playlistStage(facts)).toBe(stage);
    expect(PLAYLIST_STAGE_LABEL[playlistStage(facts)]).toBe(label);
  });
});
