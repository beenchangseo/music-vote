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

async function draw(query: string) {
  const res = await GET(new NextRequest(`https://plypick.kr/api/og?${query}`));
  render(drawn.element!);
  return res;
}

const youtubeFetches = () => fetched.filter((url) => url.includes("img.youtube.com"));
const coverImages = () => Array.from(document.querySelectorAll("img"));
const drawnPictures = () => coverImages().map((img) => atob(img.getAttribute("src")!.replace("data:image/jpeg;base64,", "")));

const FIVE = new URLSearchParams({ variant: "playlist", title: "UX 워크스루 테스트", songs: "5", participants: "1", cover: IDS.join(",") });
FIVE.append("name", "낭만고양이");
FIVE.append("name", "벚꽃 엔딩");
const TWO = new URLSearchParams({ variant: "playlist", title: "합주", songs: "2", cover: IDS[0], name: "낭만고양이" });

describe("GET /api/og vote invite card", () => {
  it("draws the four song pictures and the first song names", async () => {
    const res = await draw(FIVE.toString());
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
    const res = await draw(TWO.toString());
    expect(drawnPictures()).toEqual([thumb(IDS[0], size)]);
    expect(screen.getByText("2곡")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it("does not lose the lone picture to a slow answer for a size the video lacks", async () => {
    // A missing maxresdefault once took 1.3s to 404, past the whole picture budget.
    hanging = ["maxresdefault"];
    const res = await draw(TWO.toString());
    expect(drawnPictures()).toEqual([thumb(IDS[0], "hqdefault")]);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it.each<[string, string[], string]>([
    ["the first of four videos is gone", [IDS[0]], IDS[1]],
    ["the third of four videos is gone", [IDS[2]], IDS[0]],
    ["three of four videos are gone", [IDS[0], IDS[1], IDS[3]], IDS[2]],
  ])("keeps the cover when %s: the first picture that loaded, alone, kept a week", async (_, gone, shown) => {
    missing = gone;
    const res = await draw(FIVE.toString());
    expect(drawnPictures()).toEqual([thumb(shown, "mqdefault")]);
    expect(screen.getByText("낭만고양이·벚꽃 엔딩")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it.each<[string, URLSearchParams, string[]]>([
    ["none of the four pictures loads", FIVE, IDS],
    ["the one video is gone", TWO, [IDS[0]]],
  ])("falls back to the text card when %s, and keeps it only briefly", async (_, query, gone) => {
    missing = gone;
    const res = await draw(query.toString());
    expect(coverImages()).toHaveLength(0);
    expect(screen.queryByText(/낭만고양이/)).not.toBeInTheDocument();
    expect(screen.getByText(query.get("title")!)).toBeInTheDocument();
    expect(screen.getByText("지금 투표하기 →")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=60");
  });

  it("keeps the text card for an empty playlist without asking YouTube", async () => {
    const res = await draw(new URLSearchParams({ variant: "playlist", title: "새 합주", songs: "0" }).toString());
    expect(youtubeFetches()).toHaveLength(0);
    expect(coverImages()).toHaveLength(0);
    expect(screen.getByText("새 합주")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });
});
