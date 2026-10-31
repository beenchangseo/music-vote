import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "@/actions/__tests__/fake-supabase";

const db = vi.hoisted(() => ({
  songs: [] as { title: string; youtube_video_id: string; created_at: string }[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () =>
    createFakeClient((op) => {
      if (op.table === "playlists") return { data: { id: "p1", title: "UX 워크스루 테스트", share_code: "qDPJnh1d" } };
      if (op.table === "songs") return { data: db.songs };
      return { data: null };
    }).client,
  createServerSupabaseClient: async () =>
    createFakeClient((op) =>
      op.table === "playlist_stats" ? { data: { song_count: db.songs.length, participant_count: db.songs.length > 0 ? 1 : 0 } } : { data: null },
    ).client,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => null }));
vi.mock("@/actions/team", () => ({ getMyTeams: async () => ({ teams: [] }) }));
vi.mock("@/components/playlist/PlaylistClient", () => ({ default: () => null }));

import { generateMetadata } from "../page";

const props = { params: Promise.resolve({ shareCode: "qDPJnh1d" }) };

afterEach(() => {
  db.songs = [];
});

describe("/playlist/[shareCode] link preview", () => {
  it("unfurls a pasted link as the same vote invite card the share button sends", async () => {
    db.songs = [
      { title: "[MV] 체리필터 - 낭만고양이 | Cherryfilter - Romantic Cat", youtube_video_id: "oSlqhkPa3no", created_at: "2026-10-01T10:00:00+00:00" },
      { title: "버스커 버스커 (Busker Busker) - 벚꽃 엔딩", youtube_video_id: "tXV7dfvSefo", created_at: "2026-10-01T10:01:00+00:00" },
      { title: "요루시카 - 그저 네게 맑아라(ただ君に晴れ) [가사/발음/해석]", youtube_video_id: "Ciea1ARtPzg", created_at: "2026-10-01T10:02:00+00:00" },
      { title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]", youtube_video_id: "Ejc__vhP2U8", created_at: "2026-10-01T10:03:00+00:00" },
      { title: "그녀가 웃었다 She Smiled", youtube_video_id: "8XqtC-sD2sY", created_at: "2026-10-01T10:04:00+00:00" },
    ];
    const meta = await generateMetadata(props);
    expect(meta.description).toBe("낭만고양이·벚꽃 엔딩 외 3곡 · 1명 참여 중");
    const image = new URL(String((meta.openGraph?.images as string[])[0]), "https://plypick.kr");
    expect(image.pathname).toBe("/api/og");
    expect(image.searchParams.get("variant")).toBe("playlist");
    expect(image.searchParams.get("songs")).toBe("5");
    expect(image.searchParams.get("cover")).toBe("oSlqhkPa3no,tXV7dfvSefo,Ciea1ARtPzg,Ejc__vhP2U8");
    expect(image.searchParams.getAll("name")).toEqual(["낭만고양이", "벚꽃 엔딩"]);
  });

  it("keeps the count line for an empty playlist", async () => {
    const meta = await generateMetadata(props);
    expect(meta.description).toBe("0곡 등록 | 밴드 곡 투표에 참여하세요!");
    const image = new URL(String((meta.openGraph?.images as string[])[0]), "https://plypick.kr");
    expect(image.searchParams.get("variant")).toBe("playlist");
    expect(image.searchParams.get("cover")).toBeNull();
  });
});
