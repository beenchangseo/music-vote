import { describe, expect, it, vi } from "vitest";
import {
  inviteCardParams,
  inviteDescription,
  inviteSongs,
  inviteSongsLine,
  parseInviteSongs,
  type InviteSongs,
} from "../invite-card";

// Real titles from the 2026-10 walkthrough room, added in this order.
const NANGMAN = { title: "[MV] 체리필터 - 낭만고양이 | Cherryfilter - Romantic Cat", youtube_video_id: "oSlqhkPa3no", created_at: "2026-10-01T10:00:00+00:00" };
const BEOTKKOT = { title: "버스커 버스커 (Busker Busker) - 벚꽃 엔딩", youtube_video_id: "tXV7dfvSefo", created_at: "2026-10-01T10:01:00+00:00" };
const YORUSHIKA = { title: "요루시카 - 그저 네게 맑아라(ただ君に晴れ) [가사/발음/해석]", youtube_video_id: "Ciea1ARtPzg", created_at: "2026-10-01T10:02:00+00:00" };
const YEPPEOSSEO = { title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]", youtube_video_id: "Ejc__vhP2U8", created_at: "2026-10-01T10:03:00+00:00" };
// A song added on this device a moment ago carries a client timestamp in the "Z" form.
const SMILED = { title: "그녀가 웃었다 She Smiled", youtube_video_id: "8XqtC-sD2sY", created_at: "2026-10-01T10:04:00.000Z" };

const ALL_IDS = ["oSlqhkPa3no", "tXV7dfvSefo", "Ciea1ARtPzg", "Ejc__vhP2U8"] as const;

describe("inviteSongs", () => {
  it.each([
    {
      case: "no songs: no cover, no names",
      songs: [],
      expected: { cover: [], names: [], count: 0 },
    },
    {
      case: "one song: its picture alone",
      songs: [NANGMAN],
      expected: { cover: ["oSlqhkPa3no"], names: ["낭만고양이"], count: 1 },
    },
    {
      case: "three songs: the first song's picture alone, like the room cover",
      songs: [NANGMAN, BEOTKKOT, YORUSHIKA],
      expected: { cover: ["oSlqhkPa3no"], names: ["낭만고양이", "벚꽃 엔딩"], count: 3 },
    },
    {
      case: "four songs: the 2×2 cover",
      songs: [NANGMAN, BEOTKKOT, YORUSHIKA, YEPPEOSSEO],
      expected: { cover: ALL_IDS, names: ["낭만고양이", "벚꽃 엔딩"], count: 4 },
    },
    {
      case: "five songs in score order: back to the order they were added",
      songs: [YEPPEOSSEO, SMILED, NANGMAN, YORUSHIKA, BEOTKKOT],
      expected: { cover: ALL_IDS, names: ["낭만고양이", "벚꽃 엔딩"], count: 5 },
    },
    {
      case: "the same video twice counts as one picture",
      songs: [NANGMAN, BEOTKKOT, { ...NANGMAN, created_at: "2026-10-01T10:01:30+00:00" }, YORUSHIKA],
      expected: { cover: ["oSlqhkPa3no"], names: ["낭만고양이", "벚꽃 엔딩"], count: 4 },
    },
  ])("$case", ({ songs, expected }) => {
    expect(inviteSongs(songs)).toEqual(expected);
  });

  it.each([
    ["Don't Look Back in Anger", "Don't Look…"],
    ["사랑하긴 했었나요 스쳐가는 인연이었나요 짧지않은 우리 함께했던 시간들이", "사랑하긴 했었나요…"],
    ["ABCDEFGHIJKLMNOP", "ABCDEFGHIJK…"],
    // Exactly twelve characters stays whole.
    ["주저하는 연인들을 위해", "주저하는 연인들을 위해"],
    // Korean without spaces is cut mid-word.
    ["그대에게보내는마지막사랑노래", "그대에게보내는마지막사…"],
    // The same title in decomposed Hangul (NFD, as macOS writes file names) counts one character per syllable.
    ["그대에게보내는마지막사랑노래".normalize("NFD"), "그대에게보내는마지막사…".normalize("NFD")],
    // An emoji family is one character, never cut into its people.
    ["우리 가족👨‍👩‍👧‍👦 행복송", "우리 가족👨‍👩‍👧‍👦 행복송"],
    ["Family👨‍👩‍👧‍👦👨‍👩‍👧‍👦 Song", "Family👨‍👩‍👧‍👦👨‍👩‍👧‍👦…"],
    // A flag is one character, never a lone letter.
    ["대한민국응원가요🇰🇷🇰🇷🇰🇷", "대한민국응원가요🇰🇷🇰🇷🇰🇷"],
  ])("clips the long name %j to %j", (title, name) => {
    expect(inviteSongs([{ ...NANGMAN, title }]).names).toEqual([name]);
  });
});

describe("inviteCardParams and parseInviteSongs", () => {
  const five = inviteSongs([NANGMAN, BEOTKKOT, YORUSHIKA, YEPPEOSSEO, SMILED]);

  it("draws the vote invite card with the playlist's title and counts", () => {
    const params = inviteCardParams("UX 워크스루 테스트", 3, five);
    expect(params.get("variant")).toBe("playlist");
    expect(params.get("title")).toBe("UX 워크스루 테스트");
    expect(params.get("songs")).toBe("5");
    expect(params.get("participants")).toBe("3");
  });

  it.each([
    ["five songs", five],
    ["one song", inviteSongs([NANGMAN])],
    ["no songs", inviteSongs([])],
  ])("the image route reads back what the share sent: %s", (_, songs) => {
    expect(parseInviteSongs(new URLSearchParams(inviteCardParams("합주", 0, songs).toString()))).toEqual(songs);
  });

  const parse = (query: string) => parseInviteSongs(new URLSearchParams(query));

  it.each<[string, string, InviteSongs]>([
    [
      "anything that is not a YouTube video id is dropped, so the route never fetches a URL it was handed",
      "songs=2&cover=https://evil.example/x.png,../../a,oSlqhkPa3no",
      { cover: ["oSlqhkPa3no"], names: [], count: 2 },
    ],
    ["two or three pictures make a single cover", "songs=3&cover=oSlqhkPa3no,tXV7dfvSefo", { cover: ["oSlqhkPa3no"], names: [], count: 3 }],
    [
      "more than four pictures keep the first four",
      `songs=9&cover=${[...ALL_IDS, "8XqtC-sD2sY"].join(",")}`,
      { cover: ALL_IDS, names: [], count: 9 },
    ],
    [
      "more than two names keep the first two, clipped",
      "songs=3&name=Don't Look Back in Anger&name=예뻤어&name=벚꽃 엔딩",
      { cover: [], names: ["Don't Look…", "예뻤어"], count: 3 },
    ],
    ["a missing or broken song count is zero", "songs=-4&cover=oSlqhkPa3no", { cover: ["oSlqhkPa3no"], names: [], count: 0 }],
    ["an old link without songs is an empty card", "variant=playlist&title=합주", { cover: [], names: [], count: 0 }],
  ])("%s", (_, query, expected) => {
    expect(parse(query)).toEqual(expected);
  });
});

describe("inviteSongsLine", () => {
  const songs = (names: string[], count: number): InviteSongs => ({ cover: [], names, count });

  it.each([
    ["two short names and the rest", songs(["낭만고양이", "벚꽃 엔딩"], 5), { names: "낭만고양이·벚꽃 엔딩", more: "외 3곡" }],
    ["two songs: nothing left over", songs(["예뻤어", "벚꽃 엔딩"], 2), { names: "예뻤어·벚꽃 엔딩", more: "" }],
    ["one song", songs(["낭만고양이"], 1), { names: "낭만고양이", more: "" }],
    ["two long names that do not fit: the first one and the rest", songs(["Don't Look…", "사랑하긴 했었나요…"], 5), { names: "Don't Look…", more: "외 4곡" }],
  ])("on the card: %s", (_, input, expected) => {
    expect(inviteSongsLine(input, 16)).toEqual(expected);
  });

  it("keeps both names where there is no width limit", () => {
    expect(inviteSongsLine(songs(["Don't Look…", "사랑하긴 했었나요…"], 5))).toEqual({
      names: "Don't Look…·사랑하긴 했었나요…",
      more: "외 3곡",
    });
  });
});

describe("inviteDescription", () => {
  it.each([
    ["names the first songs with the participants", inviteSongs([NANGMAN, BEOTKKOT, YORUSHIKA, YEPPEOSSEO, SMILED]), 3, "낭만고양이·벚꽃 엔딩 외 3곡 · 3명 참여 중"],
    ["names the songs before anyone has voted", inviteSongs([YEPPEOSSEO, BEOTKKOT]), 0, "벚꽃 엔딩·예뻤어 | 밴드 곡 투표에 참여하세요!"],
    ["keeps the count line for an empty playlist", inviteSongs([]), 0, "0곡 등록 | 밴드 곡 투표에 참여하세요!"],
  ])("%s", (_, songs, participants, expected) => {
    expect(inviteDescription(songs, participants)).toBe(expected);
  });
});

describe("browsers without Intl.Segmenter (Firefox before 125)", () => {
  it("still loads and clips names by code point", async () => {
    const { Segmenter } = Intl;
    Reflect.deleteProperty(Intl, "Segmenter");
    try {
      vi.resetModules();
      const { inviteSongs: load } = await import("../invite-card");
      expect(load([{ ...NANGMAN, title: "가나다라마바사아자차카타파하" }]).names).toEqual(["가나다라마바사아자차카…"]);
    } finally {
      Reflect.set(Intl, "Segmenter", Segmenter);
      vi.resetModules();
    }
  });
});
