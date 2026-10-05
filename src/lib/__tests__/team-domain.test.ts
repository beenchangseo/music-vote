import { describe, expect, it } from "vitest";
import {
  bandShareDescription,
  canPromote,
  formatShowDate,
  isInviteCodeFormat,
  isTeamIdFormat,
  kstDateString,
  previewMemberNames,
  roomSharePrefix,
  shareableShowDate,
  showDateParts,
  showDday,
  showDdayLabel,
  validateNextShowDate,
  validateTeamName,
} from "../team-domain";
import { teamMessage, TEAM_FALLBACK_MESSAGE } from "../team-messages";
import { ARCHIVED_PLAYLIST_MESSAGE } from "../playlist-archive";

// 2026-10-04 12:00 KST
const NOON_KST = new Date("2026-10-04T03:00:00Z");
// 2026-10-04 00:30 KST, which is still 2026-10-03 in UTC
const JUST_AFTER_MIDNIGHT_KST = new Date("2026-10-03T15:30:00Z");
// 2026-10-03 23:59 KST
const JUST_BEFORE_MIDNIGHT_KST = new Date("2026-10-03T14:59:00Z");

describe("kstDateString", () => {
  it.each([
    ["noon", NOON_KST, "2026-10-04"],
    ["00:30 KST (previous day in UTC)", JUST_AFTER_MIDNIGHT_KST, "2026-10-04"],
    ["23:59 KST", JUST_BEFORE_MIDNIGHT_KST, "2026-10-03"],
    ["new year in KST, old year in UTC", new Date("2026-12-31T15:00:00Z"), "2027-01-01"],
  ])("uses the KST calendar date at %s", (_label, now, expected) => {
    expect(kstDateString(now)).toBe(expected);
  });
});

describe("showDday", () => {
  it.each([
    ["twelve days ahead", "2026-10-16", NOON_KST, { state: "upcoming", date: "2026-10-16", days: 12 }],
    ["tomorrow", "2026-10-05", NOON_KST, { state: "upcoming", date: "2026-10-05", days: 1 }],
    ["show day", "2026-10-04", NOON_KST, { state: "today", date: "2026-10-04" }],
    ["show day right after KST midnight", "2026-10-04", JUST_AFTER_MIDNIGHT_KST, { state: "today", date: "2026-10-04" }],
    ["the evening before, KST", "2026-10-04", JUST_BEFORE_MIDNIGHT_KST, { state: "upcoming", date: "2026-10-04", days: 1 }],
    ["the day after the show", "2026-10-03", NOON_KST, { state: "ended", date: "2026-10-03", daysAgo: 1 }],
    ["fourteen days after", "2026-09-20", NOON_KST, { state: "ended", date: "2026-09-20", daysAgo: 14 }],
    ["fifteen days after", "2026-09-19", NOON_KST, { state: "none" }],
    ["across a month boundary", "2026-11-01", NOON_KST, { state: "upcoming", date: "2026-11-01", days: 28 }],
  ])("%s", (_label, date, now, expected) => {
    expect(showDday(date, now)).toEqual(expected);
  });

  it.each([null, undefined, "", "2026-13-01", "2026-02-30", "2026/10/16", "10월 16일", "2026-10-16T00:00:00Z"])(
    "treats %j as no date",
    (value) => {
      expect(showDday(value, NOON_KST)).toEqual({ state: "none" });
    },
  );
});

describe("validateNextShowDate", () => {
  it.each([
    ["today", "2026-10-04", NOON_KST, null],
    ["a future date", "2026-10-16", NOON_KST, null],
    ["yesterday", "2026-10-03", NOON_KST, "past_date"],
    ["KST today at 00:30 (UTC still yesterday)", "2026-10-04", JUST_AFTER_MIDNIGHT_KST, null],
    ["UTC today but already past in KST", "2026-10-03", JUST_AFTER_MIDNIGHT_KST, "past_date"],
    ["an impossible date", "2026-02-30", NOON_KST, "invalid_date"],
    ["a non-padded date", "2026-1-5", NOON_KST, "invalid_date"],
    ["a timestamp", "2026-10-16T00:00:00Z", NOON_KST, "invalid_date"],
    ["an empty string", "", NOON_KST, "invalid_date"],
  ])("%s → %s", (_label, value, now, expected) => {
    expect(validateNextShowDate(value, now)).toBe(expected);
  });
});

describe("validateTeamName", () => {
  it.each([
    ["one character", "A", "A"],
    ["fifty characters", "가".repeat(50), "가".repeat(50)],
    ["surrounding spaces", "  일코해제  ", "일코해제"],
    ["control characters", "일코\u0000해제\n", "일코해제"],
    ["emoji counted as one character each", "🎸".repeat(50), "🎸".repeat(50)],
  ])("accepts %s", (_label, raw, expected) => {
    expect(validateTeamName(raw)).toBe(expected);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["only control characters", "\u0007\t"],
    ["fifty-one characters", "가".repeat(51)],
    ["fifty-one emoji", "🎸".repeat(51)],
    ["not a string", 42],
    ["null", null],
  ])("rejects %s", (_label, raw) => {
    expect(validateTeamName(raw)).toBeNull();
  });
});

describe("isInviteCodeFormat", () => {
  it.each([
    ["nanoid(10)", "aB3_x-9Zq0", true],
    ["nine characters", "aB3_x-9Zq", false],
    ["eleven characters", "aB3_x-9Zq01", false],
    ["a dot", "aB3_x.9Zq0", false],
    ["a path", "../../etc/", false],
    ["not a string", 1234567890, false],
  ])("%s → %s", (_label, code, expected) => {
    expect(isInviteCodeFormat(code)).toBe(expected);
  });
});

describe("isTeamIdFormat", () => {
  it.each([
    ["a uuid", "3f2b8c1e-6a4d-4f0e-9b7a-2c1d5e8f9a01", true],
    ["upper case uuid", "3F2B8C1E-6A4D-4F0E-9B7A-2C1D5E8F9A01", true],
    ["an invite code", "aB3_x-9Zq0", false],
    ["empty", "", false],
    ["undefined", undefined, false],
  ])("%s → %s", (_label, id, expected) => {
    expect(isTeamIdFormat(id)).toBe(expected);
  });
});

describe("canPromote", () => {
  const ME = "user-1";
  it.each([
    ["my room without a band", { creator_user_id: ME, team_id: null }, null],
    ["a pre-login archived room", { creator_user_id: null, team_id: null }, "archived"],
    ["someone else's room", { creator_user_id: "user-2", team_id: null }, "not_room_owner"],
    ["my room already in a band", { creator_user_id: ME, team_id: "team-1" }, "already_in_team"],
  ])("%s → %s", (_label, playlist, expected) => {
    expect(canPromote(playlist, ME)).toBe(expected);
  });
});

describe("previewMemberNames", () => {
  it("puts the owner first, then members in join order, and stops at three", () => {
    expect(
      previewMemberNames([
        { display_name: "기타", role: "member", joined_at: "2026-10-02T00:00:00+00:00" },
        { display_name: "베이스", role: "member", joined_at: "2026-10-01T00:00:00+00:00" },
        { display_name: "드럼", role: "member", joined_at: "2026-10-03T00:00:00+00:00" },
        { display_name: "보컬", role: "owner", joined_at: "2026-10-04T00:00:00+00:00" },
      ]),
    ).toEqual(["보컬", "베이스", "기타"]);
  });

  it("returns fewer names when the band is small", () => {
    expect(previewMemberNames([{ display_name: "보컬", role: "owner", joined_at: null }])).toEqual(["보컬"]);
  });
});

describe("teamMessage", () => {
  it("maps known reason codes to Korean copy", () => {
    expect(teamMessage("not_member")).toBe("밴드 멤버만 할 수 있어요");
    expect(teamMessage("archived")).toBe(ARCHIVED_PLAYLIST_MESSAGE);
    expect(teamMessage("invite_rotated_remove_failed")).toBe(
      "링크는 바꿨지만 내보내지 못했어요. 다시 눌러 주세요",
    );
  });

  it.each([
    ["an unknown reason", "something_new"],
    ["a thrown error", new Error("internal details")],
    ["undefined", undefined],
    ["an inherited key", "toString"],
  ])("falls back to the default copy for %s", (_label, input) => {
    expect(teamMessage(input)).toBe(TEAM_FALLBACK_MESSAGE);
  });
});

describe("show date formatting (cards and screens)", () => {
  it("reads month, day and weekday from the date itself", () => {
    expect(showDateParts("2026-10-16")).toEqual({ month: 10, day: 16, weekday: "금" });
    expect(showDateParts("2027-01-01")).toEqual({ month: 1, day: 1, weekday: "금" });
    expect(showDateParts("2026-02-30")).toBeNull();
  });

  it("formats the exact date with or without the weekday", () => {
    expect(formatShowDate("2026-10-16")).toBe("10월 16일(금)");
    expect(formatShowDate("2026-10-16", false)).toBe("10월 16일");
    expect(formatShowDate("nope")).toBeNull();
  });

  it("labels only upcoming and same-day shows (no past dates on screen lines)", () => {
    expect(showDdayLabel(showDday("2026-10-16", NOON_KST))).toBe("공연 D-12");
    expect(showDdayLabel(showDday("2026-10-04", NOON_KST))).toBe("공연 D-DAY");
    expect(showDdayLabel(showDday("2026-10-03", NOON_KST))).toBeNull();
    expect(showDdayLabel(showDday(null, NOON_KST))).toBeNull();
  });

  it("puts only today-or-later dates on share cards, never a D-day number", () => {
    expect(shareableShowDate("2026-10-16", NOON_KST)).toBe("2026-10-16");
    expect(shareableShowDate("2026-10-04", JUST_AFTER_MIDNIGHT_KST)).toBe("2026-10-04");
    expect(shareableShowDate("2026-10-03", NOON_KST)).toBeNull();
    expect(shareableShowDate(null, NOON_KST)).toBeNull();

    const withDate = bandShareDescription("2026-10-16", 4, NOON_KST);
    expect(withDate).toBe("10월 16일(금) 공연 · 멤버 4명");
    expect(withDate).not.toMatch(/D-/);
    expect(bandShareDescription("2026-10-03", 4, NOON_KST)).toBe("멤버 4명 · 카카오 로그인 한 번이면 합류");
    expect(bandShareDescription(null, 1, NOON_KST)).toBe("멤버 1명 · 카카오 로그인 한 번이면 합류");
  });

  it("prefixes the room card only while the show is ahead", () => {
    expect(roomSharePrefix("2026-10-16", NOON_KST)).toBe("10월 16일 공연 · ");
    expect(roomSharePrefix("2026-10-03", NOON_KST)).toBe("");
    expect(roomSharePrefix(null, NOON_KST)).toBe("");
  });
});
