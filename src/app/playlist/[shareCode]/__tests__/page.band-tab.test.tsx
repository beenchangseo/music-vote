// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "@/actions/__tests__/fake-supabase";

const TEAM = "7ea70000-0000-4000-8000-000000000001";
const HOST = "9c1f6a2e-1111-4111-8111-000000000001";
const MEMBER = "9c1f6a2e-2222-4222-8222-000000000002";
const OUTSIDER = "9c1f6a2e-3333-4333-8333-000000000003";

const state = vi.hoisted(() => ({ user: null as { id: string; nickname: string; avatarUrl: string | null } | null }));

/** The band's playlists as the tab bar's picker reads them: this one still voting, an older one confirmed. */
const BAND_PLAYLISTS = [
  { share_code: "qDPJnh1d", title: "11월 합주", created_at: "2026-11-01T00:00:00+00:00", setlist_confirmed: false, setlist_items: [] },
  {
    share_code: "oct00001",
    title: "10월 합주",
    created_at: "2026-10-01T00:00:00+00:00",
    setlist_confirmed: true,
    setlist_items: [
      { item_type: "song", song_id: "s-1" },
      { item_type: "interval", song_id: null },
    ],
  },
];

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () =>
    createFakeClient((op) => {
      if (op.table === "playlists" && op.filters.team_id) return { data: BAND_PLAYLISTS };
      if (op.table === "playlists") {
        return {
          data: {
            id: "7d0c2b4a-5555-4555-8555-000000000010",
            title: "11월 합주",
            share_code: "qDPJnh1d",
            deadline: null,
            created_at: "2026-11-01T00:00:00+00:00",
            setlist_count: null,
            announcement: null,
            setlist_confirmed: false,
            creator_nickname: "방장",
            creator_user_id: HOST,
            votes_anonymous: true,
            voting_mode: "free",
            default_vote_limit: 3,
            setlist_edit_mode: "everyone",
            team_id: TEAM,
          },
        };
      }
      if (op.table === "teams") return { data: { id: TEAM, name: "주말밴드", next_show_at: null } };
      if (op.table === "team_members") {
        return { data: op.filters.user_id === MEMBER ? { user_id: MEMBER } : null };
      }
      return { data: [] };
    }).client,
  createServerSupabaseClient: async () =>
    createFakeClient((op) => (op.table === "playlist_stats" ? { data: { song_count: 0, participant_count: 2 } } : { data: [] })).client,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/actions/team", () => ({ getMyTeams: async () => ({ teams: [] }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

// The client screen as it renders, minus what needs a browser API or the network.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/qDPJnh1d" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("@/components/ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/playlist-refetch", () => ({ fetchSetlistItems: vi.fn().mockResolvedValue([]), fetchComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/setlist", () => ({}));
vi.mock("@/hooks/usePlaylistRealtime", () => ({ usePlaylistRealtime: () => ({ notifyChange: vi.fn() }) }));
vi.mock("@/hooks/usePlaylistVotes", () => ({
  usePlaylistVotes: ({ songs }: { songs: unknown[] }) => ({ songsWithVotes: songs, pressVote: vi.fn(), isVotePending: () => false, resetVotes: vi.fn() }),
}));
vi.mock("@/hooks/usePlayerQueue", () => ({
  usePlayerQueue: () => ({
    state: { currentSongId: null, currentSong: null, isPlaying: false, repeatMode: "off" },
    actions: { playNext: vi.fn(), playSong: vi.fn(), setIsPlaying: vi.fn() },
  }),
}));
vi.mock("@/components/playlist/AnnouncementButton", () => ({ default: () => null }));
vi.mock("@/components/playlist/AddSongForm", () => ({ default: () => null }));
vi.mock("@/components/playlist/SongCard", () => ({ default: () => null }));
vi.mock("@/components/playlist/MiniPlayer", () => ({ default: () => null }));
vi.mock("@/components/playlist/YouTubePlayer", () => ({ default: () => null }));
vi.mock("@/components/playlist/RoomSettingsButton", () => ({ default: () => null }));
vi.mock("@/components/setlist/SetlistView", () => ({ default: () => null }));
vi.mock("@/components/rehearsal/RehearsalView", () => ({ default: () => null }));
vi.mock("@/components/auth/LoginButton", () => ({ default: ({ label }: { label?: string }) => <button type="button">{label}</button> }));

import PlaylistPage from "../page";

/** The props the server hands to the client screen, and the screen they draw. */
async function openPlaylist() {
  const element = (await PlaylistPage({
    params: Promise.resolve({ shareCode: "qDPJnh1d" }),
    searchParams: Promise.resolve({}),
  })) as ReactElement<{ team: unknown; bandPlaylists: unknown }>;
  render(element);
  return element.props;
}

const firstTab = () => within(screen.getByRole("navigation", { name: "플레이리스트 화면" })).getAllByRole("link")[0];

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  state.user = null;
  vi.restoreAllMocks();
});

// The server gives the band link only to its members (#106), so for anyone else the first tab can only go home.
describe("/playlist/[shareCode] first tab for each viewer of a band playlist (#106)", () => {
  it("hands a band member the band id, and the first tab goes to that band home", async () => {
    state.user = { id: MEMBER, nickname: "기타", avatarUrl: null };

    expect((await openPlaylist()).team).toMatchObject({ id: TEAM, isMember: true });
    expect(firstTab()).toHaveAccessibleName("밴드 홈");
    expect(firstTab()).toHaveAttribute("href", `/band/${TEAM}`);
  });

  it.each([
    ["a logged-in viewer outside the band", { id: OUTSIDER, nickname: "손님", avatarUrl: null }],
    ["a logged-out visitor", null],
  ])("hands %s no band id, and the first tab is 홈 to the app home", async (_who, user) => {
    state.user = user;

    expect((await openPlaylist()).team).toMatchObject({ id: null, isMember: false });
    expect(firstTab()).toHaveAccessibleName("홈");
    expect(firstTab()).toHaveAttribute("href", "/");
  });
});

// The picker lists the band's playlists, so only a member may receive them, like the band link above (#110).
describe("/playlist/[shareCode] band playlists for the tab bar's picker (#110)", () => {
  it("hands a band member the band's playlists with their stages, and 플레이리스트 opens them with this one checked", async () => {
    state.user = { id: MEMBER, nickname: "기타", avatarUrl: null };

    expect((await openPlaylist()).bandPlaylists).toEqual([
      { shareCode: "qDPJnh1d", title: "11월 합주", createdAt: "2026-11-01T00:00:00+00:00", stage: "voting" },
      { shareCode: "oct00001", title: "10월 합주", createdAt: "2026-10-01T00:00:00+00:00", stage: "confirmed" },
    ]);
    fireEvent.click(within(screen.getByRole("navigation", { name: "플레이리스트 화면" })).getByRole("button", { name: "플레이리스트" }));
    const picker = screen.getByRole("dialog", { name: "플레이리스트" });
    expect(within(picker).getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "page");
    expect(within(picker).getByRole("link")).toHaveAttribute("href", "/playlist/oct00001");
  });

  it.each([
    ["a logged-in viewer outside the band", { id: OUTSIDER, nickname: "손님", avatarUrl: null }],
    ["a logged-out visitor", null],
  ])("hands %s none of the band's other playlists", async (_who, user) => {
    state.user = user;

    const props = await openPlaylist();
    expect(props.bandPlaylists).toBeNull();
    expect(JSON.stringify(props)).not.toContain("oct00001");
  });
});
