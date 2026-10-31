// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, RoomTeam } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/actions/setlist", () => ({ getSetlistItems: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/comment", () => ({ getComments: vi.fn().mockResolvedValue([]) }));
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
vi.mock("../AnnouncementButton", () => ({ default: () => <button type="button">공지</button> }));
vi.mock("../AddSongForm", () => ({ default: () => null }));
vi.mock("../SongCard", () => ({ default: () => null }));
vi.mock("../MiniPlayer", () => ({ default: () => null }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
vi.mock("../RoomSettingsButton", () => ({ default: () => null }));
vi.mock("../../setlist/SetlistView", () => ({ default: () => null }));
vi.mock("../../rehearsal/RehearsalView", () => ({ default: () => null }));
vi.mock("../../auth/LoginButton", () => ({
  default: ({ label, variant }: { label?: string; variant?: string }) => <button type="button" data-variant={variant}>{label}</button>,
}));
vi.mock("../NavigationBar", () => ({
  default: ({ onModeChange }: { onModeChange: (mode: string) => void }) => (
    <nav>
      <button type="button" onClick={() => onModeChange("playlist")}>후보곡</button>
      <button type="button" onClick={() => onModeChange("setlist")}>셋리스트</button>
      <button type="button" onClick={() => onModeChange("rehearsal")}>합주</button>
    </nav>
  ),
}));

const TEAM = "11111111-1111-4111-8111-111111111111";
const OWNER = "user-owner";

const playlist: Playlist = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "10월 합주",
  share_code: "abc123",
  deadline: null,
  setlist_count: null,
  announcement: null,
  setlist_confirmed: false,
  creator_nickname: "보컬",
  creator_user_id: OWNER,
  votes_anonymous: true,
  voting_mode: "free",
  default_vote_limit: 3,
  setlist_edit_mode: "everyone",
  created_at: "2026-10-01T00:00:00Z",
  team_id: TEAM,
};
const band: RoomTeam = { id: TEAM, name: "일코해제", nextShowAt: null, isMember: true };

type Props = Parameters<typeof PlaylistClient>[0];

function renderRoom(overrides: Partial<Props> = {}) {
  render(<PlaylistClient playlist={playlist} songs={[]} shareCode="abc123" participantCount={2} userNickname="보컬" currentUserId={OWNER} team={band} {...overrides} />);
}

const roomActions = () => ["카카오톡 공유", "공지", "플레이리스트 메뉴"].map((name) => screen.queryByRole("button", { name }));

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PlaylistClient header per tab (#4)", () => {
  it("keeps the cover header with share, notice and menu on the candidates tab", () => {
    renderRoom();

    for (const action of roomActions()) expect(action).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "10월 합주" })).toBeInTheDocument();
  });

  it.each(["셋리스트", "합주"])("folds the %s tab header into one line: back to the band, title, account", (tab) => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: tab }));

    for (const action of roomActions()) expect(action).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /일코해제/ })).toHaveAttribute("href", `/band/${TEAM}`);
    expect(screen.getByRole("heading", { level: 1, name: "10월 합주" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보컬 계정 메뉴" })).toBeInTheDocument();
  });

  it("points the one-line header home when the viewer is not in the band", () => {
    renderRoom({ team: null, currentUserId: null, userNickname: undefined });
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { level: 1, name: "10월 합주" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /계정 메뉴/ })).not.toBeInTheDocument();
  });

  it.each(["셋리스트", "합주"])("gives a logged-out viewer the candidates tab's login button on the %s tab", (tab) => {
    renderRoom({ team: null, currentUserId: null, userNickname: undefined });
    fireEvent.click(screen.getByRole("button", { name: tab }));

    const login = within(screen.getByRole("banner")).getByRole("button", { name: "로그인" });
    expect(login).toHaveAttribute("data-variant", "tonal");
  });

  it("leaves the login button out of the one-line header for a logged-in member", () => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(within(screen.getByRole("banner")).queryByRole("button", { name: "로그인" })).not.toBeInTheDocument();
  });

  it("opens every tab at its top, so the shorter header does not drop the reader mid-list", () => {
    renderRoom();

    for (const tab of ["셋리스트", "합주", "후보곡"]) {
      vi.mocked(window.scrollTo).mockClear();
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    }
  });

  it("brings the cover header back on the candidates tab", () => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
    fireEvent.click(screen.getByRole("button", { name: "후보곡" }));

    for (const action of roomActions()) expect(action).toBeInTheDocument();
  });
});
