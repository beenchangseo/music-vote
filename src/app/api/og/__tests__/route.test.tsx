// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const drawn = vi.hoisted(() => ({ element: null as ReactElement | null }));

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: ReactElement) {
      drawn.element = element;
    }
    async arrayBuffer() {
      return new ArrayBuffer(0);
    }
  },
}));

import { GET } from "../route";
import { signShareCard } from "@/lib/share-card";
import type { SignedCard } from "@/domain/share-card";

const IDS = ["oSlqhkPa3no", "tXV7dfvSefo", "Ciea1ARtPzg", "Ejc__vhP2U8"];
const thumb = (id: string, size: string) => `https://img.youtube.com/vi/${id}/${size}.jpg`;

// YouTube answers 404 for any picture URL containing one of these (a gone video, a size it never made).
let missing: string[];
// YouTube does not answer these until the route gives up on them.
let hanging: string[];
const fetched: string[] = [];

beforeEach(() => {
  missing = [];
  hanging = [];
  fetched.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      fetched.push(url);
      if (!url.includes("img.youtube.com")) return new Response(new ArrayBuffer(8));
      if (missing.some((part) => url.includes(part))) return new Response(null, { status: 404 });
      if (hanging.some((part) => url.includes(part))) {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
      }
      // The body names the picture, so a test can read back which one was drawn.
      return new Response(new TextEncoder().encode(url), { headers: { "Content-Type": "image/jpeg" } });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  drawn.element = null;
});

/** `image` is a site path, `/api/og?…`, as a page or the share button sends it. */
async function draw(image: string) {
  const res = await GET(new NextRequest(new URL(image, "https://plypick.kr")));
  render(drawn.element!);
  return res;
}

const youtubeFetches = () => fetched.filter((url) => url.includes("img.youtube.com"));
const coverImages = () => Array.from(document.querySelectorAll("img"));
const drawnPictures = () => coverImages().map((img) => atob(img.getAttribute("src")!.replace("data:image/jpeg;base64,", "")));

type InviteCard = Extract<SignedCard, { kind: "invite" }>;

const FIVE: InviteCard = {
  kind: "invite",
  title: "UX 워크스루 테스트",
  participants: 1,
  songs: { cover: [IDS[0], IDS[1], IDS[2], IDS[3]], names: ["낭만고양이", "벚꽃 엔딩"], count: 5 },
};
const TWO: InviteCard = { kind: "invite", title: "합주", participants: 0, songs: { cover: [IDS[0]], names: ["낭만고양이"], count: 2 } };

describe("GET /api/og vote invite card", () => {
  it("draws the four song pictures and the first song names", async () => {
    const res = await draw(await signShareCard(FIVE));
    expect(youtubeFetches()).toEqual(IDS.map((id) => thumb(id, "mqdefault")));
    expect(drawnPictures()).toEqual(IDS.map((id) => thumb(id, "mqdefault")));
    expect(screen.getByText("낭만고양이·벚꽃 엔딩")).toBeInTheDocument();
    expect(screen.getByText("외 3곡")).toBeInTheDocument();
    expect(screen.getByText("UX 워크스루 테스트")).toBeInTheDocument();
    expect(screen.getByText("5곡 · 1명 참여")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it.each<[string, string[], string]>([
    ["the HD picture", [], "maxresdefault"],
    ["the 480px picture when the video has no HD one", ["maxresdefault"], "hqdefault"],
    ["the small picture when that is all there is", ["maxresdefault", "hqdefault"], "mqdefault"],
  ])("draws one picture for a playlist with fewer than four, from %s", async (_, gone, size) => {
    missing = gone;
    const res = await draw(await signShareCard(TWO));
    expect(drawnPictures()).toEqual([thumb(IDS[0], size)]);
    expect(screen.getByText("2곡")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it("does not lose the lone picture to a slow answer for a size the video lacks", async () => {
    // A missing maxresdefault once took 1.3s to 404, past the whole picture budget.
    hanging = ["maxresdefault"];
    const res = await draw(await signShareCard(TWO));
    expect(drawnPictures()).toEqual([thumb(IDS[0], "hqdefault")]);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it.each<[string, string[], string]>([
    ["the first of four videos is gone", [IDS[0]], IDS[1]],
    ["the third of four videos is gone", [IDS[2]], IDS[0]],
    ["three of four videos are gone", [IDS[0], IDS[1], IDS[3]], IDS[2]],
  ])("keeps the cover when %s: the first picture that loaded, alone, kept a week", async (_, gone, shown) => {
    missing = gone;
    const res = await draw(await signShareCard(FIVE));
    expect(drawnPictures()).toEqual([thumb(shown, "mqdefault")]);
    expect(screen.getByText("낭만고양이·벚꽃 엔딩")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it.each<[string, InviteCard, string[]]>([
    ["none of the four pictures loads", FIVE, IDS],
    ["the one video is gone", TWO, [IDS[0]]],
  ])("falls back to the text card when %s, and keeps it only briefly", async (_, card, gone) => {
    missing = gone;
    const res = await draw(await signShareCard(card));
    expect(coverImages()).toHaveLength(0);
    expect(screen.queryByText(/낭만고양이/)).not.toBeInTheDocument();
    expect(screen.getByText(card.title)).toBeInTheDocument();
    expect(screen.getByText("지금 투표하기 →")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=60");
  });

  it("keeps the text card for an empty playlist without asking YouTube", async () => {
    const res = await draw(
      await signShareCard({ kind: "invite", title: "새 합주", participants: 0, songs: { cover: [], names: [], count: 0 } }),
    );
    expect(youtubeFetches()).toHaveLength(0);
    expect(coverImages()).toHaveLength(0);
    expect(screen.getByText("새 합주")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });
});

const PHISH = "⚠️ 계정 정지 예정 · bit.ly/abc 에서 인증하세요";
const query = (params: Record<string, string>) => `/api/og?${new URLSearchParams(params)}`;

describe("GET /api/og links nobody signed", () => {
  it.each([
    ["the #35 phishing link", query({ variant: "decided", title: PHISH, topSong: PHISH, topArtist: "bit.ly/abc" })],
    ["an old vote invite link with pictures", query({ variant: "playlist", title: PHISH, songs: "5", cover: IDS.join(","), name: PHISH })],
    ["an old band invite link", query({ variant: "band", title: PHISH, members: "4", date: "2026-10-16" })],
    ["an old setlist link", query({ variant: "setlist", title: PHISH, setlistCount: "6" })],
    ["an old archived playlist link", query({ title: PHISH, songs: "5", participants: "1" })],
    ["the old site card link", query({ title: "Plypick", subtitle: PHISH })],
  ])("draws the site card for %s, with none of its words, as a 200 image", async (_, image) => {
    const res = await draw(image);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
    expect(screen.getByText("Plypick")).toBeInTheDocument();
    expect(screen.getByText("밴드 합주곡, 투표로 정해요")).toBeInTheDocument();
    expect(screen.queryByText(/계정 정지|bit\.ly/)).not.toBeInTheDocument();
    expect(youtubeFetches()).toHaveLength(0);
  });

  it("draws the site card for one card's words carrying another card's signature", async () => {
    const real = await signShareCard({ kind: "band", name: "일코해제", members: 4, showDate: null });
    const forged = await signShareCard({ kind: "band", name: PHISH, members: 4, showDate: null });
    await draw(`${forged.slice(0, forged.lastIndexOf("."))}${real.slice(real.lastIndexOf("."))}`);
    expect(screen.getByText("밴드 합주곡, 투표로 정해요")).toBeInTheDocument();
    expect(screen.queryByText(PHISH)).not.toBeInTheDocument();
  });

  it("ignores words added beside a signed card", async () => {
    await draw(`${await signShareCard({ kind: "band", name: "일코해제", members: 4, showDate: null })}&title=${encodeURIComponent(PHISH)}`);
    expect(screen.getByText("일코해제")).toBeInTheDocument();
    expect(screen.queryByText(PHISH)).not.toBeInTheDocument();
  });
});

describe("GET /api/og cards the server signed", () => {
  it.each<[string, SignedCard, string[]]>([
    [
      "the voting result",
      { kind: "decided", title: "10월 합주", participants: 4, songs: 7, top: { title: "낭만고양이", artist: "체리필터", score: 5 } },
      ["🎉 다음 합주곡 결정", "10월 합주", "낭만고양이", "체리필터", "+5점 1위"],
    ],
    ["the setlist", { kind: "setlist", title: "11월 공연", participants: 4, setlistCount: 6 }, ["11월 공연", "총 6곡 · 다음 공연 준비 완료"]],
    ["the band invite", { kind: "band", name: "일코해제", members: 4, showDate: "2026-10-16" }, ["일코해제", "10월 16일(금) 공연"]],
  ])("draws %s with its words", async (_, card, words) => {
    const res = await draw(await signShareCard(card));
    for (const word of words) expect(screen.getByText(word)).toBeInTheDocument();
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });
});

describe("GET /api/og image search", () => {
  it("lets only the bare site card into image search", async () => {
    expect((await draw("/api/og")).headers.get("X-Robots-Tag")).toBeNull();
    cleanup();
    expect((await draw(query({ title: "Plypick", subtitle: "밴드 합주곡, 투표로 정해요" }))).headers.get("X-Robots-Tag")).toBe("noindex");
  });
});
