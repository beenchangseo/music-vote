// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchComments, fetchSetlistItems } from "@/lib/playlist-refetch";
import type { Comment, PlaylistView, SetlistItem } from "@/domain/types";
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
vi.mock("../../rehearsal/RehearsalView", () => ({
  default: ({ comments, setlistItems, loading }: { comments: Comment[]; setlistItems: SetlistItem[]; loading: boolean }) =>
    loading ? <p>합주 불러오는 중</p> : <p>{`댓글 ${comments.length}개 · 셋리스트 ${setlistItems.length}줄`}</p>,
}));
vi.mock("../../auth/LoginButton", () => ({ default: () => null }));
// The real SetlistView puts the view switcher between its own header and its action row.
vi.mock("../../setlist/SetlistView", () => ({
  default: ({ setlistItems, switcher }: { setlistItems: SetlistItem[]; switcher: ReactNode }) => (
    <>
      {switcher}
      <ol aria-label="셋리스트">{setlistItems.map((item) => <li key={item.id}>{item.label}</li>)}</ol>
    </>
  ),
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

const comment = { id: "c-1", song_id: "s-1", nickname: "보컬", content: "브릿지 반 박자 빨라요", created_at: "", updated_at: "", isMine: false } as Comment;

type Props = Parameters<typeof PlaylistClient>[0];

function renderRoom(overrides: Partial<Props> = {}) {
  render(<PlaylistClient playlist={playlist} songs={[]} shareCode="abc123" participantCount={2} loggedIn={false} isHost={false} initialSetlistItems={[opener]} {...overrides} />);
}

const views = () => screen.getByRole("radiogroup", { name: "플레이리스트 보기" });
const currentView = () => within(views()).getByRole("radio", { checked: true });

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PlaylistClient first view (#80, #110)", () => {
  it("opens on the setlist the page read when the link asks for it", () => {
    renderRoom({ initialTab: "setlist" });

    expect(currentView()).toHaveTextContent("셋리스트");
    expect(within(screen.getByRole("list", { name: "셋리스트" })).getByText("사운드 체크")).toBeInTheDocument();
    expect(fetchSetlistItems).not.toHaveBeenCalled();
  });

  it("drops the link's tab from the address once the member picks a tab, so a refresh stays where they are", () => {
    window.history.replaceState(null, "", "/playlist/abc123?utm_source=kakao&tab=setlist");
    renderRoom({ initialTab: "setlist" });

    fireEvent.click(within(views()).getByRole("radio", { name: "후보곡" }));

    expect(currentView()).toHaveTextContent("후보곡");
    expect(`${window.location.pathname}${window.location.search}`).toBe("/playlist/abc123?utm_source=kakao");
  });

  it("opens on 합주 when the link asks for it, and loads its comments the way a tap does", async () => {
    vi.mocked(fetchComments).mockResolvedValue([comment]);
    renderRoom({ initialTab: "rehearsal" });

    expect(currentView()).toHaveTextContent("합주");
    expect(screen.getByRole("heading", { level: 1, name: "10월 합주" })).toHaveClass("sr-only");
    expect(await screen.findByText("댓글 1개 · 셋리스트 1줄")).toBeInTheDocument();
    expect(fetchComments).toHaveBeenCalledWith(playlist.id);
    expect(fetchSetlistItems).not.toHaveBeenCalled();
  });

  it("opens on 후보곡 otherwise", () => {
    renderRoom();

    expect(currentView()).toHaveTextContent("후보곡");
    expect(screen.queryByRole("list", { name: "셋리스트" })).not.toBeInTheDocument();
  });
});

describe("PlaylistClient views and tab bar (#110)", () => {
  it("switches 후보곡 · 셋리스트 · 합주 with the segment under the header, not with the bottom tabs", async () => {
    vi.mocked(fetchComments).mockResolvedValue([comment]);
    renderRoom();
    expect(within(views()).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["후보곡", "셋리스트", "합주"]);

    fireEvent.click(within(views()).getByRole("radio", { name: "셋리스트" }));
    expect(currentView()).toHaveTextContent("셋리스트");
    expect(within(screen.getByRole("list", { name: "셋리스트" })).getByText("사운드 체크")).toBeInTheDocument();

    fireEvent.click(within(views()).getByRole("radio", { name: "합주" }));
    expect(currentView()).toHaveTextContent("합주");
    expect(await screen.findByText("댓글 1개 · 셋리스트 1줄")).toBeInTheDocument();

    const tabs = screen.getByRole("navigation", { name: "플레이리스트 화면" });
    expect([...tabs.querySelectorAll("a, button")].map((tab) => tab.textContent)).toEqual(["홈", "플레이리스트", "만들기"]);
  });

  it("leaves making a new playlist to the tab bar's 만들기, with no second link at the end of the page", () => {
    renderRoom({ songs: [{ id: "s-1", title: "Creep", score: 1 } as Props["songs"][number]] });
    const links = screen.getAllByRole("link").filter((link) => /만들기/.test(link.textContent ?? ""));
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([["만들기", "/new"]]);
  });
});
