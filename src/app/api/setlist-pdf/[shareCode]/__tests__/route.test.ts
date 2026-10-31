import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "@/actions/__tests__/fake-supabase";
import { formatRuntime } from "@/domain/setlist";
import { FIXTURE_SONG_COUNT, FIXTURE_TOTAL_SECONDS, fixtureItems, fixtureSongs } from "@/domain/__tests__/setlist-fixture";

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => fixtureAdmin() }));

function fixtureAdmin() {
  return createFakeClient((op) => {
    if (op.table === "playlists") return { data: { id: "playlist", title: "가을 공연" } };
    if (op.table === "setlist_items") return { data: fixtureItems };
    return { data: fixtureSongs.filter((song) => (op.filters.id as string[]).includes(song.id)) };
  }).client;
}

import { GET } from "../route";

// Any real font works here: the test reads the strings handed to PDFKit, not the glyphs.
const FONT = readFileSync(createRequire(import.meta.url).resolve("next/dist/compiled/@vercel/og/Geist-Regular.ttf"));

async function drawSetlistPdf() {
  const text = vi.spyOn(PDFDocument.prototype, "text");
  const response = await GET(new Request("https://plypick.kr/api/setlist-pdf/share"), { params: Promise.resolve({ shareCode: "share" }) });
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  return text.mock.calls.map(([value]) => String(value));
}

describe("GET /api/setlist-pdf/[shareCode]", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(FONT)));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prints the same song count and total as the setlist tab", async () => {
    expect(await drawSetlistPdf()).toContain(
      `${FIXTURE_SONG_COUNT}곡 · ${formatRuntime(FIXTURE_TOTAL_SECONDS)} · 1곡 시간 미입력`,
    );
  });

  it("numbers songs and originals like the setlist tab and prints no row for a deleted song", async () => {
    const printed = await drawSetlistPdf();
    expect(printed.filter((value) => /^\d+$/.test(value))).toEqual(["1", "2", "3", "4"]);
    expect(printed).toContain("우리 노래");
    expect(printed).toContain("첫 자작곡 · 3:45");
  });
});
