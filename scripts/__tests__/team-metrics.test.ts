import { describe, expect, it } from "vitest";
import { computeTeamMetrics, kstDate, parseIdList } from "../team-metrics.mjs";

const OPERATOR = "u-operator";
const E2E = "u-e2e";

// Band A: operator's band. Band B: external band. Band C: has a test account → excluded.
const teams = [
  { id: "A", name: "일코해제", created_at: "2026-10-10T00:00:00Z", created_by: OPERATOR, next_show_at: "2026-11-01" },
  { id: "B", name: "산울림", created_at: "2026-10-12T00:00:00Z", created_by: "u-b-owner", next_show_at: null },
  { id: "C", name: "테스트 밴드", created_at: "2026-10-12T00:00:00Z", created_by: "u-c-owner", next_show_at: "2026-11-02" },
];

const teamMembers = [
  { team_id: "A", user_id: OPERATOR, role: "owner" },
  { team_id: "A", user_id: "u-a-guitar", role: "member" },
  { team_id: "A", user_id: "u-a-drum", role: "member" },
  { team_id: "B", user_id: "u-b-owner", role: "owner" },
  { team_id: "B", user_id: "u-b-bass", role: "member" },
  { team_id: "C", user_id: "u-c-owner", role: "owner" },
  { team_id: "C", user_id: E2E, role: "member" },
];

const playlists = [
  // A: the room it was promoted from, a room made from the band home, an older room attached later,
  //    and a room made at home after the band existed then attached (13A).
  { id: "a-promote", team_id: "A", team_linked_via: "promote", creator_user_id: OPERATOR, created_at: "2026-09-01T00:00:00Z" },
  { id: "a-band", team_id: "A", team_linked_via: "band", creator_user_id: OPERATOR, created_at: "2026-10-20T00:00:00Z" },
  { id: "a-old", team_id: "A", team_linked_via: "attach", creator_user_id: OPERATOR, created_at: "2026-07-01T00:00:00Z" },
  { id: "a-attach-new", team_id: "A", team_linked_via: "attach", creator_user_id: OPERATOR, created_at: "2026-10-25T00:00:00Z" },
  // B: one band room created by the bassist.
  { id: "b-band", team_id: "B", team_linked_via: "band", creator_user_id: "u-b-bass", created_at: "2026-10-15T00:00:00Z" },
  // C: excluded band, would otherwise count everywhere.
  { id: "c-band", team_id: "C", team_linked_via: "band", creator_user_id: "u-c-owner", created_at: "2026-10-15T00:00:00Z" },
];

const songs = [
  { id: "s-old", playlist_id: "a-old", added_by_user_id: "u-a-guitar", created_at: "2026-07-02T00:00:00Z" },
  { id: "s-band", playlist_id: "a-band", added_by_user_id: "u-a-drum", created_at: "2026-10-20T01:00:00Z" },
  { id: "s-b", playlist_id: "b-band", added_by_user_id: "u-b-bass", created_at: "2026-10-15T01:00:00Z" },
  { id: "s-c", playlist_id: "c-band", added_by_user_id: "u-c-owner", created_at: "2026-10-15T01:00:00Z" },
];

const votes = [
  // Old votes in the attached room (before the band) must not count.
  { song_id: "s-old", user_id: "u-a-guitar", created_at: "2026-07-03T00:00:00Z" },
  { song_id: "s-old", user_id: "u-a-guitar", created_at: "2026-07-04T00:00:00Z" },
  // Guitar: 2026-10-21 14:00Z (= 10-21 23:00 KST) and 2026-10-21 16:00Z (= 10-22 01:00 KST) → two KST days.
  { song_id: "s-band", user_id: "u-a-guitar", created_at: "2026-10-21T14:00:00Z" },
  { song_id: "s-band", user_id: "u-a-guitar", created_at: "2026-10-21T16:00:00Z" },
  // The room creator (operator, owner) voting in their own band room does not count.
  { song_id: "s-band", user_id: OPERATOR, created_at: "2026-10-21T00:00:00Z" },
  // Someone outside the band does not count.
  { song_id: "s-band", user_id: "u-stranger", created_at: "2026-10-21T00:00:00Z" },
  // B: the owner votes in the bassist's room → a non-creator member vote. The bassist is the creator.
  { song_id: "s-b", user_id: "u-b-owner", created_at: "2026-10-16T00:00:00Z" },
  { song_id: "s-b", user_id: "u-b-bass", created_at: "2026-10-16T00:00:00Z" },
  // C: excluded.
  { song_id: "s-c", user_id: E2E, created_at: "2026-10-16T00:00:00Z" },
  { song_id: "s-c", user_id: E2E, created_at: "2026-10-18T00:00:00Z" },
];

const comments = [{ song_id: "s-b", user_id: "u-b-bass", created_at: "2026-10-15T02:00:00Z" }];

const data = { teams, teamMembers, playlists, songs, votes, comments };

describe("computeTeamMetrics", () => {
  const metrics = computeTeamMetrics(data, {
    e2eIds: new Set([E2E]),
    operatorIds: new Set([OPERATOR]),
    launchDate: "2026-10-11",
  });

  it("drops every band that has a test account as owner or member", () => {
    expect(metrics.excludedBandCount).toBe(1);
    expect(metrics.bands.map((band) => band.id)).toEqual(["A", "B"]);
  });

  it("counts bands and external bands (owner is not an operator)", () => {
    expect(metrics.bandsCreated).toBe(2);
    expect(metrics.externalBandsCreated).toBe(1);
    expect(metrics.bands.find((band) => band.id === "B")?.external).toBe(true);
  });

  it("counts a band when one plain member was active on two different KST days, inside the period", () => {
    // A: guitar has two KST days in the band room; the July votes are outside the period.
    // B: bassist added a song and commented on 10-15, voted on 10-16 → two days.
    expect(metrics.bands.find((band) => band.id === "A")?.maxMemberActiveDays).toBe(2);
    expect(metrics.bands.find((band) => band.id === "B")?.maxMemberActiveDays).toBe(2);
    expect(metrics.bandsWithMemberActiveTwoDays).toBe(2);
  });

  it("separates rooms made from the band ('band') from attached and promoted rooms", () => {
    expect(metrics.bandRoomCount).toBe(2);
    expect(metrics.bandsWithBandRoom).toBe(2);
    expect(metrics.attachedAfterCreationCount).toBe(1);
    expect(metrics.bandsWithAttachedAfterCreation).toBe(1);
    expect(metrics.attachedOlderRoomCount).toBe(1);
    expect(metrics.promotedRoomCount).toBe(1);
  });

  it("counts votes in band rooms by members other than the room creator", () => {
    // A: guitar ×2 (creator and stranger excluded). B: owner ×1 (creator excluded).
    expect(metrics.nonCreatorMemberVotesInBandRooms).toBe(3);
  });

  it("reports how many bands set a show date", () => {
    expect(metrics.bandsWithNextShow).toBe(1);
  });

  it("uses the launch date as the period start when it is later than the band's creation", () => {
    const later = computeTeamMetrics(data, {
      e2eIds: new Set([E2E]),
      operatorIds: new Set([OPERATOR]),
      // After the guitar's 10-21 votes (KST 10-22 01:00 is still before 10-23).
      launchDate: "2026-10-23",
    });
    expect(later.bands.find((band) => band.id === "A")?.maxMemberActiveDays).toBe(0);
    expect(later.nonCreatorMemberVotesInBandRooms).toBe(0);
  });

  it("without test account ids nothing is excluded", () => {
    const all = computeTeamMetrics(data, { e2eIds: new Set(), operatorIds: new Set([OPERATOR]), launchDate: null });
    expect(all.excludedBandCount).toBe(0);
    expect(all.bandsCreated).toBe(3);
  });
});

describe("helpers", () => {
  it("uses the KST calendar date", () => {
    expect(kstDate("2026-10-21T14:59:00Z")).toBe("2026-10-21");
    expect(kstDate("2026-10-21T15:00:00Z")).toBe("2026-10-22");
  });

  it("parses comma separated id lists", () => {
    expect([...parseIdList(" a, b ,,c ")]).toEqual(["a", "b", "c"]);
    expect(parseIdList(undefined).size).toBe(0);
  });
});
