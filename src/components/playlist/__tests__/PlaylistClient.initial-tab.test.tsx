// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSetlistItems } from "@/lib/playlist-refetch";
import type { PlaylistView, SetlistItem } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
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
vi.mock("../AnnouncementButton", () => ({ default: () => null }));
vi.mock("../AddSongForm", () => ({ default: () => null }));
vi.mock("../SongCard", () => ({ default: () => null }));
vi.mock("../MiniPlayer", () => ({ default: () => null }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
vi.mock("../RoomSettingsButton", () => ({ default: () => null }));
vi.mock("../../rehearsal/RehearsalView", () => ({ default: () => null }));
vi.mock("../../auth/LoginButton", () => ({ default: () => null }));
vi.mock("../../setlist/SetlistView", () => ({
  default: ({ setlistItems }: { setlistItems: SetlistItem[] }) => <ol aria-label="셋리스트">{setlistItems.map((item) => <li key={item.id}>{item.label}</li>)}</ol>,
}));

const playlist = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "10월 합주",
  share_code: "abc123",
  deadline: null,
  setlist_count: null,
  announcement: null,
  setlist_confirmed: true,
  creator_nickname: "보컬",
  archived: false,
  votes_anonymous: true,
  voting_mode: "free",
  default_vote_limit: 3,
  setlist_edit_mode: "everyone",
  created_at: "2026-10-01T00:00:00Z",
  team_id: null,
} as PlaylistView;

const opener = { id: "item-1", playlist_id: playlist.id, position: 0, item_type: "interval", song_id: null, label: "사운드 체크", description: null, duration_seconds: 120, title_override: null, duration_override_seconds: null, created_at: "" } as SetlistItem;

type Props = Parameters<typeof PlaylistClient>[0];

function renderRoom(overrides: Partial<Props> = {}) {
  render(<PlaylistClient playlist={playlist} songs={[]} shareCode="abc123" participantCount={2} loggedIn={false} isHost={false} initialSetlistItems={[opener]} {...overrides} />);
}

const currentTab = () => within(screen.getByRole("navigation", { name: "플레이리스트 화면" })).getByRole("button", { current: "page" });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PlaylistClient first tab (#80)", () => {
  it("opens on the setlist the page read when the link asks for it", () => {
    renderRoom({ initialTab: "setlist" });

    expect(currentTab()).toHaveTextContent("셋리스트");
    expect(within(screen.getByRole("list", { name: "셋리스트" })).getByText("사운드 체크")).toBeInTheDocument();
    expect(fetchSetlistItems).not.toHaveBeenCalled();
  });

  it("drops the link's tab from the address once the member picks a tab, so a refresh stays where they are", () => {
    window.history.replaceState(null, "", "/playlist/abc123?utm_source=kakao&tab=setlist");
    renderRoom({ initialTab: "setlist" });

    fireEvent.click(within(screen.getByRole("navigation", { name: "플레이리스트 화면" })).getByRole("button", { name: /후보곡/ }));

    expect(currentTab()).toHaveTextContent("후보곡");
    expect(`${window.location.pathname}${window.location.search}`).toBe("/playlist/abc123?utm_source=kakao");
  });

  it("opens on 후보곡 otherwise", () => {
    renderRoom();

    expect(currentTab()).toHaveTextContent("후보곡");
    expect(screen.queryByRole("list", { name: "셋리스트" })).not.toBeInTheDocument();
  });
});
