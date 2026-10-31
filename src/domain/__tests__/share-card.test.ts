import { describe, expect, it } from "vitest";
import { inviteSongs } from "../invite-card";
import {
  bandCard,
  decodeShareCard,
  encodeShareCard,
  playlistResultCards,
  playlistShareCard,
  type ShareCard,
  type SignedCard,
} from "../share-card";

const NANGMAN = { title: "[MV] 체리필터 - 낭만고양이 | Cherryfilter - Romantic Cat", youtube_video_id: "oSlqhkPa3no", created_at: "2026-10-01T10:00:00+00:00" };
const BEOTKKOT = { title: "버스커 버스커 (Busker Busker) - 벚꽃 엔딩", youtube_video_id: "tXV7dfvSefo", created_at: "2026-10-01T10:01:00+00:00" };

// One card of every kind the route can draw from a signature.
const CARDS = {
  invite: { kind: "invite", title: "10월 정기 합주 🎸", participants: 3, songs: inviteSongs([NANGMAN, BEOTKKOT]) },
  decided: { kind: "decided", title: "합주", participants: 4, songs: 7, top: { title: "낭만고양이", artist: "체리필터", score: 5 } },
  setlist: { kind: "setlist", title: "11월 공연", participants: 4, setlistCount: 6 },
  band: { kind: "band", name: "일코해제", members: 4, showDate: "2026-10-16" },
} satisfies { [K in SignedCard["kind"]]: Extract<SignedCard, { kind: K }> };

describe("encodeShareCard and decodeShareCard", () => {
  it.each(Object.values(CARDS))("the route reads back the $kind card the server sent", (card) => {
    const payload = encodeShareCard(card);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareCard(payload)).toEqual(card);
  });

  it("sends the same card as the same text, so the CDN and Kakao keep one copy", () => {
    expect(encodeShareCard(CARDS.invite)).toBe(encodeShareCard({ ...CARDS.invite }));
  });

  it.each([
    ["text that is not base64url", "%%%"],
    ["base64url that is not JSON", "bm90IGpzb24"],
    ["a card kind the route does not know", encodeShareCard({ ...CARDS.band, kind: "phish" } as unknown as SignedCard)],
    ["the site card, which is never signed", encodeShareCard({ kind: "site" } as unknown as SignedCard)],
  ])("decodes nothing from %s", (_, payload) => {
    expect(decodeShareCard(payload)).toBeNull();
  });
});

describe("playlistShareCard", () => {
  it("sends the vote invite card with the first songs", () => {
    const songs = inviteSongs([NANGMAN, BEOTKKOT]);
    expect(playlistShareCard({ title: "합주", archived: false }, 2, songs)).toEqual({
      card: { kind: "invite", title: "합주", participants: 2, songs },
      description: "낭만고양이·벚꽃 엔딩 · 2명 참여 중",
    });
  });

  it("sends the site card for an archived playlist, whose title no Kakao account owns", () => {
    const shared = playlistShareCard({ title: "옛날 합주", archived: true }, 2, inviteSongs([NANGMAN, BEOTKKOT]));
    expect(shared.card).toEqual<ShareCard>({ kind: "site" });
    expect(shared.description).toBe("2곡 등록 · 2명 참여 중");
  });
});

describe("playlistResultCards", () => {
  const ranked = [
    { title: "낭만고양이", artist: "체리필터", score: 5 },
    { title: "벚꽃 엔딩", artist: null, score: 2 },
  ];

  it("puts the top song on the result card and counts the setlist", () => {
    expect(playlistResultCards({ title: "합주", archived: false, setlistCount: 1 }, 3, ranked)).toEqual({
      decided: { kind: "decided", title: "합주", participants: 3, songs: 2, top: { title: "낭만고양이", artist: "체리필터", score: 5 } },
      setlist: { kind: "setlist", title: "합주", participants: 3, setlistCount: 1 },
    });
  });

  it("counts every song when the playlist sets no setlist size, and shows no negative score", () => {
    const cards = playlistResultCards({ title: "합주", archived: false, setlistCount: null }, 0, [
      { title: "싫어요 받은 곡", artist: null, score: -2 },
    ]);
    expect(cards.decided).toMatchObject({ top: { title: "싫어요 받은 곡", artist: "", score: 0 } });
    expect(cards.setlist).toMatchObject({ setlistCount: 1 });
  });

  it.each([
    ["a playlist without songs", { title: "합주", archived: false, setlistCount: null }, []],
    ["an archived playlist", { title: "합주", archived: true, setlistCount: null }, ranked],
  ])("sends the site card for %s", (_, playlist, songs) => {
    expect(playlistResultCards(playlist, 1, songs)).toEqual({ decided: { kind: "site" }, setlist: { kind: "site" } });
  });
});

describe("bandCard", () => {
  // 2026-10-04 12:00 KST
  const now = new Date("2026-10-04T03:00:00Z");

  it("carries the exact show date while the show is ahead", () => {
    expect(bandCard("일코해제", 4, "2026-10-16", now)).toEqual({ kind: "band", name: "일코해제", members: 4, showDate: "2026-10-16" });
  });

  it("drops a past show date (25A)", () => {
    expect(bandCard("일코해제", 4, "2026-10-03", now)).toMatchObject({ showDate: null });
  });
});
