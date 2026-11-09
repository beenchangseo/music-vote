import { afterEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { createFakeClient, type FakeResult } from "@/actions/__tests__/fake-supabase";
import type { SetlistItem } from "@/domain/types";

const db = vi.hoisted(() => ({
  songs: [] as { id: string; title: string; youtube_video_id: string; created_at: string; duration_seconds: number | null }[],
  // A playlist made before Kakao login has no creator account (ADR 0012).
  creator: "u1" as string | null,
  setlistConfirmed: false,
  setlist: { data: [] } as FakeResult,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () =>
    createFakeClient((op) => {
      if (op.table === "playlists") {
        return {
          data: { id: "p1", title: "UX 워크스루 테스트", share_code: "qDPJnh1d", creator_user_id: db.creator, setlist_confirmed: db.setlistConfirmed },
        };
      }
      if (op.table === "songs") return { data: db.songs };
      if (op.table === "setlist_items") return db.setlist;
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

const FIVE_SONGS = [
  { id: "s1", title: "[MV] 체리필터 - 낭만고양이 | Cherryfilter - Romantic Cat", youtube_video_id: "oSlqhkPa3no", created_at: "2026-10-01T10:00:00+00:00", duration_seconds: 245 },
  { id: "s2", title: "버스커 버스커 (Busker Busker) - 벚꽃 엔딩", youtube_video_id: "tXV7dfvSefo", created_at: "2026-10-01T10:01:00+00:00", duration_seconds: 302 },
  { id: "s3", title: "요루시카 - 그저 네게 맑아라(ただ君に晴れ) [가사/발음/해석]", youtube_video_id: "Ciea1ARtPzg", created_at: "2026-10-01T10:02:00+00:00", duration_seconds: 219 },
  { id: "s4", title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]", youtube_video_id: "Ejc__vhP2U8", created_at: "2026-10-01T10:03:00+00:00", duration_seconds: 260 },
  { id: "s5", title: "그녀가 웃었다 She Smiled", youtube_video_id: "8XqtC-sD2sY", created_at: "2026-10-01T10:04:00+00:00", duration_seconds: null },
];

const block = (songId: string, position: number) =>
  ({ id: `b${position}`, playlist_id: "p1", position, item_type: "song", song_id: songId, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

// 245 + 302 + 219 s = 12 min 46 s.
const THREE_BLOCKS = [block("s1", 0), block("s2", 1), block("s3", 2)];

const props = (search: Record<string, string> = {}) => ({
  params: Promise.resolve({ shareCode: "qDPJnh1d" }),
  searchParams: Promise.resolve(search),
});
const setlistLink = props({ tab: "setlist" });

const ogImage = (meta: Metadata) => new URL(String((meta.openGraph?.images as string[])[0]), "https://plypick.kr");

afterEach(() => {
  db.songs = [];
  db.creator = "u1";
  db.setlistConfirmed = false;
  db.setlist = { data: [] };
  vi.restoreAllMocks();
});

describe("/playlist/[shareCode] link preview", () => {
  it("unfurls a pasted link as the same vote invite card the share button sends", async () => {
    db.songs = FIVE_SONGS;
    db.setlist = { data: THREE_BLOCKS };
    const meta = await generateMetadata(props());
    expect(meta.openGraph?.title).toBe("UX 워크스루 테스트 - Plypick");
    expect(meta.description).toBe("낭만고양이·벚꽃 엔딩 외 3곡 · 1명 참여 중");
    const image = ogImage(meta);
    expect(image.pathname).toBe("/api/og");
    expect(image.searchParams.get("variant")).toBe("playlist");
    expect(image.searchParams.get("songs")).toBe("5");
    expect(image.searchParams.get("cover")).toBe("oSlqhkPa3no,tXV7dfvSefo,Ciea1ARtPzg,Ejc__vhP2U8");
    expect(image.searchParams.getAll("name")).toEqual(["낭만고양이", "벚꽃 엔딩"]);
  });

  it("keeps the count line for an empty playlist", async () => {
    const meta = await generateMetadata(props());
    expect(meta.description).toBe("0곡 등록 | 밴드 곡 투표에 참여하세요!");
    const image = ogImage(meta);
    expect(image.searchParams.get("variant")).toBe("playlist");
    expect(image.searchParams.get("cover")).toBeNull();
  });

  it("keeps the old card for an archived playlist, which takes no votes", async () => {
    db.songs = FIVE_SONGS;
    db.creator = null;
    const meta = await generateMetadata(props());
    expect(meta.description).toBe("5곡 등록 · 1명 참여 중");
    // The same URL main sent before #11, so previews already shared stay as they are.
    expect((meta.openGraph?.images as string[])[0]).toBe(
      `/api/og?title=${encodeURIComponent("UX 워크스루 테스트")}&songs=5&participants=1`,
    );
  });
});

describe("/playlist/[shareCode]?tab=setlist link preview says the setlist's stage (#94)", () => {
  it.each([
    {
      stage: "voting",
      confirmed: false,
      setlist: [],
      title: "UX 워크스루 테스트 투표 중 - Plypick",
      description: "셋리스트는 아직 비어 있어요 · 후보곡 5곡",
      image: { stage: "voting", setlistCount: "0" },
    },
    {
      stage: "building",
      confirmed: false,
      setlist: THREE_BLOCKS,
      title: "UX 워크스루 테스트 셋리스트 짜는 중 - Plypick",
      description: "지금 3곡 · 13분",
      image: { stage: "building", setlistCount: "3", minutes: "13" },
    },
    {
      stage: "confirmed",
      confirmed: true,
      setlist: THREE_BLOCKS,
      title: "UX 워크스루 테스트 셋리스트 확정 - Plypick",
      description: "총 3곡 · 13분",
      image: { stage: "confirmed", setlistCount: "3", minutes: "13" },
    },
    {
      stage: "closed",
      confirmed: true,
      setlist: [],
      title: "UX 워크스루 테스트 마감 - Plypick",
      description: "셋리스트 없이 마감됐어요",
      image: { stage: "closed", setlistCount: "0" },
    },
  ])("unfurls $stage", async ({ confirmed, setlist, title, description, image }) => {
    db.songs = FIVE_SONGS;
    db.setlistConfirmed = confirmed;
    db.setlist = { data: setlist };

    const meta = await generateMetadata(setlistLink);

    expect([meta.title, meta.openGraph?.title, meta.twitter?.title]).toEqual([title, title, title]);
    expect([meta.description, meta.openGraph?.description, meta.twitter?.description]).toEqual([description, description, description]);
    expect(ogImage(meta).pathname).toBe("/api/og");
    expect(Object.fromEntries(ogImage(meta).searchParams)).toEqual({
      variant: "setlist",
      title: "UX 워크스루 테스트",
      participants: "1",
      ...image,
    });
  });

  it("leaves the length out when a song in the setlist has none", async () => {
    db.songs = FIVE_SONGS;
    db.setlist = { data: [...THREE_BLOCKS, block("s5", 3)] };
    const meta = await generateMetadata(setlistLink);
    expect(meta.description).toBe("지금 4곡");
    expect(ogImage(meta).searchParams.has("minutes")).toBe(false);
  });

  it("unfurls as the vote invite when the setlist read fails, since the link then opens 후보곡", async () => {
    db.songs = FIVE_SONGS;
    db.setlist = { data: THREE_BLOCKS };
    const invite = await generateMetadata(props());

    db.setlist = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await generateMetadata(setlistLink)).toEqual(invite);
  });

  it("unfurls as the vote invite for any tab but an exact setlist", async () => {
    db.songs = FIVE_SONGS;
    db.setlist = { data: THREE_BLOCKS };
    const invite = await generateMetadata(props());
    expect(await generateMetadata(props({ tab: "rehearsal" }))).toEqual(invite);
    expect(await generateMetadata(props({ tab: "Setlist" }))).toEqual(invite);
  });
});
