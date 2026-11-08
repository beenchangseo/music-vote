import { describe, expect, it } from "vitest";
import { setlistShareCard, setlistStatus, type SetlistStatus } from "../setlist-card";
import { fixtureItems, fixtureSongs } from "./setlist-fixture";

// The fixture without its one song of unknown length: 120 + 200 + 180 + 225 + 263 s = 16 min 28 s, 3 songs.
const timedItems = fixtureItems.filter((item) => item.song_id !== "b");

describe("setlistStatus", () => {
  it.each([
    { case: "an empty setlist is still being voted on", confirmed: false, items: [], expected: { stage: "voting", songCount: 0, runtimeMinutes: null } },
    { case: "a setlist being built, its length rounded to the minute", confirmed: false, items: timedItems, expected: { stage: "building", songCount: 3, runtimeMinutes: 16 } },
    { case: "a confirmed setlist", confirmed: true, items: timedItems, expected: { stage: "confirmed", songCount: 3, runtimeMinutes: 16 } },
    // The cron confirms an expired playlist with no songs only to take it off its queue.
    { case: "a confirm flag on an empty setlist is closed", confirmed: true, items: [], expected: { stage: "closed", songCount: 0, runtimeMinutes: null } },
    {
      case: "one song of unknown length leaves the length out rather than state a short show",
      confirmed: false,
      items: fixtureItems,
      expected: { stage: "building", songCount: 4, runtimeMinutes: null },
    },
    {
      case: "a length under half a minute is not stated as 0분",
      confirmed: false,
      items: [{ ...timedItems[0], item_type: "original" as const, duration_seconds: 20 }],
      expected: { stage: "building", songCount: 1, runtimeMinutes: null },
    },
  ])("$case", ({ confirmed, items, expected }) => {
    expect(setlistStatus(confirmed, items, fixtureSongs)).toEqual(expected);
  });
});

describe("setlistShareCard", () => {
  const playlist = { title: "11월 정기공연", participants: 4, candidateCount: 12 };

  it.each<{ status: SetlistStatus; link: [string, string]; feed: [string, string] }>([
    {
      status: { stage: "voting", songCount: 0, runtimeMinutes: null },
      link: ["11월 정기공연 투표 중 - Plypick", "셋리스트는 아직 비어 있어요 · 후보곡 12곡"],
      feed: ["🎤 투표 중 — 11월 정기공연", "셋리스트는 아직 비어 있어요"],
    },
    {
      status: { stage: "building", songCount: 6, runtimeMinutes: 25 },
      link: ["11월 정기공연 셋리스트 짜는 중 - Plypick", "지금 6곡 · 25분"],
      feed: ["🎵 셋리스트 짜는 중 — 11월 정기공연", "지금 6곡 · 25분"],
    },
    {
      status: { stage: "confirmed", songCount: 8, runtimeMinutes: 33 },
      link: ["11월 정기공연 셋리스트 확정 - Plypick", "총 8곡 · 33분"],
      feed: ["🎵 셋리스트 확정 — 11월 정기공연", "총 8곡 · 33분 · 다음 공연 준비 완료"],
    },
    {
      status: { stage: "closed", songCount: 0, runtimeMinutes: null },
      link: ["11월 정기공연 마감 - Plypick", "셋리스트 없이 마감됐어요"],
      feed: ["마감 — 11월 정기공연", "셋리스트 없이 마감됐어요"],
    },
    {
      status: { stage: "building", songCount: 6, runtimeMinutes: null },
      link: ["11월 정기공연 셋리스트 짜는 중 - Plypick", "지금 6곡"],
      feed: ["🎵 셋리스트 짜는 중 — 11월 정기공연", "지금 6곡"],
    },
    {
      status: { stage: "confirmed", songCount: 8, runtimeMinutes: null },
      link: ["11월 정기공연 셋리스트 확정 - Plypick", "총 8곡"],
      feed: ["🎵 셋리스트 확정 — 11월 정기공연", "총 8곡 · 다음 공연 준비 완료"],
    },
  ])("says $status.stage with $status.songCount songs and $status.runtimeMinutes minutes", ({ status, link, feed }) => {
    const card = setlistShareCard(playlist, status);
    expect([card.linkTitle, card.linkDescription]).toEqual(link);
    expect([card.feedTitle, card.feedDescription]).toEqual(feed);
  });

  it("asks /api/og for the stage's picture with the setlist's counts, never the candidates", () => {
    const card = setlistShareCard(playlist, { stage: "building", songCount: 6, runtimeMinutes: 25 });
    expect(Object.fromEntries(new URLSearchParams(card.imageQuery))).toEqual({
      variant: "setlist",
      title: "11월 정기공연",
      stage: "building",
      setlistCount: "6",
      minutes: "25",
      participants: "4",
    });
  });

  it("leaves the length out of the picture's address when it is unknown", () => {
    const card = setlistShareCard(playlist, { stage: "confirmed", songCount: 8, runtimeMinutes: null });
    expect(new URLSearchParams(card.imageQuery).has("minutes")).toBe(false);
  });
});
