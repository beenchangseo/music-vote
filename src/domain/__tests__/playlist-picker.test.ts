import { describe, expect, it } from "vitest";
import { orderPlaylistPicks, playlistPick, playlistTabTarget, type PlaylistPick } from "../playlist-picker";
import type { PlaylistStage } from "../playlist-stage";

const pick = (shareCode: string, stage: PlaylistStage, createdAt: string): PlaylistPick => ({
  shareCode,
  title: shareCode,
  stage,
  createdAt,
});

describe("playlistPick", () => {
  it.each([
    [{ setlistConfirmed: false, setlistBlockCount: 0 }, "voting"],
    [{ setlistConfirmed: false, setlistBlockCount: 3 }, "building"],
    [{ setlistConfirmed: true, setlistBlockCount: 3 }, "confirmed"],
    [{ setlistConfirmed: true, setlistBlockCount: 0 }, "closed"],
  ] as const)("reads %o as %s, the stage the band home cards show", (setlist, stage) => {
    expect(playlistPick({ shareCode: "abc", title: "11월 합주", createdAt: "2026-11-01T00:00:00Z", ...setlist })).toEqual({
      shareCode: "abc",
      title: "11월 합주",
      createdAt: "2026-11-01T00:00:00Z",
      stage,
    });
  });
});

describe("orderPlaylistPicks", () => {
  it("puts the running ones (투표 중, 셋리스트 짜는 중) first, then the rest, newest first within each", () => {
    const picks = [
      pick("oct-confirmed", "confirmed", "2026-10-05T10:00:00Z"),
      pick("nov-building", "building", "2026-11-01T10:00:00Z"),
      pick("nov-closed", "closed", "2026-11-09T10:00:00Z"),
      pick("sep-voting", "voting", "2026-09-08T10:00:00Z"),
      pick("dec-voting", "voting", "2026-11-08T10:00:00Z"),
    ];
    expect(orderPlaylistPicks(picks).map((p) => p.shareCode)).toEqual([
      "dec-voting",
      "nov-building",
      "sep-voting",
      "nov-closed",
      "oct-confirmed",
    ]);
  });

  it("orders by time, not by string, within one second (Postgres drops a zero fraction)", () => {
    const picks = [pick("whole", "voting", "2026-11-01T00:00:00+00:00"), pick("half", "voting", "2026-11-01T00:00:00.5+00:00")];
    expect(orderPlaylistPicks(picks).map((p) => p.shareCode)).toEqual(["half", "whole"]);
  });

  it("leaves the list it was given alone", () => {
    const picks = [pick("old", "voting", "2026-09-01T00:00:00Z"), pick("new", "voting", "2026-11-01T00:00:00Z")];
    orderPlaylistPicks(picks);
    expect(picks.map((p) => p.shareCode)).toEqual(["old", "new"]);
  });
});

describe("playlistTabTarget", () => {
  it("opens the one running playlist straight away, however many finished ones there are", () => {
    const picks = [pick("confirmed", "confirmed", "2026-11-09T00:00:00Z"), pick("running", "building", "2026-10-01T00:00:00Z")];
    expect(playlistTabTarget(picks)).toEqual({ kind: "open", shareCode: "running" });
  });

  it.each([
    ["two running playlists", [pick("a", "voting", "2026-11-01T00:00:00Z"), pick("b", "building", "2026-10-01T00:00:00Z")]],
    ["only finished playlists", [pick("a", "confirmed", "2026-11-01T00:00:00Z"), pick("b", "closed", "2026-10-01T00:00:00Z")]],
    ["no playlist at all", []],
  ])("opens the picker with %s", (_label, picks) => {
    expect(playlistTabTarget(picks)).toEqual({ kind: "pick" });
  });
});
