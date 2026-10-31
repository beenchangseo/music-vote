// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "@/actions/__tests__/fake-supabase";
import { formatRuntime } from "@/domain/setlist";
import { FIXTURE_SONG_COUNT, FIXTURE_TOTAL_SECONDS, fixtureItems, fixtureSongs } from "@/domain/__tests__/setlist-fixture";

const drawn = vi.hoisted(() => ({ element: null as ReactElement | null }));

vi.mock("next/og", () => ({
  ImageResponse: class {
    headers = new Headers();
    constructor(element: ReactElement) {
      drawn.element = element;
    }
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => fixtureAdmin() }));

function fixtureAdmin() {
  return createFakeClient((op) => {
    if (op.table === "playlists") return { data: { id: "playlist", title: "가을 공연" } };
    if (op.table === "setlist_items") return { data: fixtureItems };
    return { data: fixtureSongs.filter((song) => (op.filters.id as string[]).includes(song.id)) };
  }).client;
}

import { GET } from "../route";

async function drawSetlistImage() {
  await GET(new NextRequest("https://plypick.kr/api/setlist-image/share"), { params: Promise.resolve({ shareCode: "share" }) });
  render(drawn.element!);
}

describe("GET /api/setlist-image/[shareCode]", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("draws the same song count and total as the setlist tab", async () => {
    await drawSetlistImage();
    expect(screen.getByText(`총 ${FIXTURE_SONG_COUNT}곡`)).toBeInTheDocument();
    expect(screen.getByText(formatRuntime(FIXTURE_TOTAL_SECONDS))).toBeInTheDocument();
  });

  it("numbers songs and originals like the setlist tab and draws no row for a deleted song", async () => {
    await drawSetlistImage();
    expect(screen.getAllByText(/^\d+$/).map((badge) => badge.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(screen.getByText("우리 노래")).toBeInTheDocument();
    expect(screen.getByText("3:45")).toBeInTheDocument();
  });

  it("draws an original's description the way it draws an interval's, so both take the same room", async () => {
    await drawSetlistImage();
    expect(screen.getByText("첫 자작곡").getAttribute("style")).toBe(screen.getByText("모니터 볼륨 맞추기").getAttribute("style"));
  });
});
