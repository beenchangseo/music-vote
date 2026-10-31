import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "@/actions/__tests__/fake-supabase";

const db = vi.hoisted(() => ({
  songs: [] as { title: string; youtube_video_id: string; created_at: string }[],
  // A playlist made before Kakao login has no creator account (ADR 0012).
  creator: "u1" as string | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () =>
    createFakeClient((op) => {
      if (op.table === "playlists") return { data: { id: "p1", title: "UX 워크스루 테스트", share_code: "qDPJnh1d", creator_user_id: db.creator } };
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

import type { Metadata } from "next";
import type { ReactElement } from "react";
import PlaylistPage, { generateMetadata } from "../page";
import { readShareCard } from "@/lib/share-card";
import type { PlaylistShareKit } from "@/components/playlist/PlaylistClient";

const FIVE_SONGS = [
  { title: "[MV] 체리필터 - 낭만고양이 | Cherryfilter - Romantic Cat", youtube_video_id: "oSlqhkPa3no", created_at: "2026-10-01T10:00:00+00:00" },
  { title: "버스커 버스커 (Busker Busker) - 벚꽃 엔딩", youtube_video_id: "tXV7dfvSefo", created_at: "2026-10-01T10:01:00+00:00" },
  { title: "요루시카 - 그저 네게 맑아라(ただ君に晴れ) [가사/발음/해석]", youtube_video_id: "Ciea1ARtPzg", created_at: "2026-10-01T10:02:00+00:00" },
  { title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]", youtube_video_id: "Ejc__vhP2U8", created_at: "2026-10-01T10:03:00+00:00" },
  { title: "그녀가 웃었다 She Smiled", youtube_video_id: "8XqtC-sD2sY", created_at: "2026-10-01T10:04:00+00:00" },
];

const props = { params: Promise.resolve({ shareCode: "qDPJnh1d" }) };

afterEach(() => {
  db.songs = [];
  db.creator = "u1";
});

/** The card the image route will draw for an og:image or share button URL. */
const drawn = (image: unknown) => readShareCard(new URL(String(image), "https://plypick.kr").searchParams);
const ogImage = (meta: Metadata) => (meta.openGraph?.images as string[])[0];

describe("/playlist/[shareCode] link preview", () => {
  it("unfurls a pasted link as the same vote invite card the share button sends", async () => {
    db.songs = FIVE_SONGS;
    const meta = await generateMetadata(props);
    expect(meta.description).toBe("낭만고양이·벚꽃 엔딩 외 3곡 · 1명 참여 중");
    expect(new URL(ogImage(meta), "https://plypick.kr").pathname).toBe("/api/og");
    await expect(drawn(ogImage(meta))).resolves.toEqual({
      kind: "invite",
      title: "UX 워크스루 테스트",
      participants: 1,
      songs: { cover: ["oSlqhkPa3no", "tXV7dfvSefo", "Ciea1ARtPzg", "Ejc__vhP2U8"], names: ["낭만고양이", "벚꽃 엔딩"], count: 5 },
    });

    const shareKit = ((await PlaylistPage(props)) as ReactElement<{ shareKit: PlaylistShareKit }>).props.shareKit;
    expect(shareKit.invite).toEqual({ image: ogImage(meta), description: meta.description });
  });

  it("keeps the count line for an empty playlist", async () => {
    const meta = await generateMetadata(props);
    expect(meta.description).toBe("0곡 등록 | 밴드 곡 투표에 참여하세요!");
    await expect(drawn(ogImage(meta))).resolves.toMatchObject({ kind: "invite", songs: { cover: [], names: [], count: 0 } });
  });

  it("unfurls an archived playlist, which takes no votes, as the site card", async () => {
    db.songs = FIVE_SONGS;
    db.creator = null;
    const meta = await generateMetadata(props);
    expect(meta.description).toBe("5곡 등록 · 1명 참여 중");
    expect(ogImage(meta)).toBe("/api/og");
  });
});

describe("/playlist/[shareCode] result share buttons", () => {
  it("hands the banners the result and setlist cards the route will draw", async () => {
    db.songs = FIVE_SONGS;
    const shareKit = ((await PlaylistPage(props)) as ReactElement<{ shareKit: PlaylistShareKit }>).props.shareKit;
    await expect(drawn(shareKit.decided)).resolves.toEqual({
      kind: "decided",
      title: "UX 워크스루 테스트",
      participants: 1,
      songs: 5,
      top: { title: FIVE_SONGS[0].title, artist: "", score: 0 },
    });
    await expect(drawn(shareKit.setlist)).resolves.toEqual({ kind: "setlist", title: "UX 워크스루 테스트", participants: 1, setlistCount: 5 });
  });
});
