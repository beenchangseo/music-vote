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
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let youtube: "ok" | "down";
const fetched: string[] = [];

beforeEach(() => {
  youtube = "ok";
  fetched.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      fetched.push(url);
      if (url.includes("img.youtube.com") && youtube === "down") return new Response(null, { status: 404 });
      if (url.includes("img.youtube.com")) return new Response(JPEG, { headers: { "Content-Type": "image/jpeg" } });
      return new Response(new ArrayBuffer(8));
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

const FIVE = new URLSearchParams({ variant: "playlist", title: "UX 워크스루 테스트", songs: "5", participants: "1", cover: IDS.join(",") });
FIVE.append("name", "낭만고양이");
FIVE.append("name", "벚꽃 엔딩");

describe("GET /api/og vote invite card", () => {
  it("draws the four song pictures and the first song names", async () => {
    const res = await draw(FIVE.toString());
    expect(youtubeFetches()).toEqual(IDS.map((id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`));
    expect(coverImages()).toHaveLength(4);
    for (const img of coverImages()) expect(img.getAttribute("src")).toBe("data:image/jpeg;base64,/9j/2Q==");
    expect(screen.getByText("낭만고양이·벚꽃 엔딩")).toBeInTheDocument();
    expect(screen.getByText("외 3곡")).toBeInTheDocument();
    expect(screen.getByText("UX 워크스루 테스트")).toBeInTheDocument();
    expect(screen.getByText("5곡 · 1명 참여")).toBeInTheDocument();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=604800");
  });

  it("draws one picture for a playlist with fewer than four", async () => {
    await draw(new URLSearchParams({ variant: "playlist", title: "합주", songs: "2", cover: IDS[0], name: "낭만고양이" }).toString());
    expect(youtubeFetches()).toHaveLength(1);
    expect(coverImages()).toHaveLength(1);
    expect(screen.getByText("2곡")).toBeInTheDocument();
  });

  it("falls back to the text card when a picture does not load, and keeps it only briefly", async () => {
    youtube = "down";
    const res = await draw(FIVE.toString());
    expect(coverImages()).toHaveLength(0);
    expect(screen.queryByText("낭만고양이·벚꽃 엔딩")).not.toBeInTheDocument();
    expect(screen.getByText("UX 워크스루 테스트")).toBeInTheDocument();
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
