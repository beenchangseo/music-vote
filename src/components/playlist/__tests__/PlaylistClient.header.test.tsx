// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaylistView, RoomTeam } from "@/domain/types";
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

const TEAM = "11111111-1111-4111-8111-111111111111";

const playlist: PlaylistView = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "10월 합주",
  share_code: "abc123",
  deadline: null,
  setlist_count: null,
  announcement: null,
  setlist_confirmed: false,
  creator_nickname: "보컬",
  archived: false,
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
  render(<PlaylistClient playlist={playlist} songs={[]} shareCode="abc123" participantCount={2} userNickname="보컬" loggedIn isHost team={band} {...overrides} />);
}

const roomActions = () => ["카카오톡 공유", "공지", "플레이리스트 메뉴"].map((name) => screen.queryByRole("button", { name }));
const SONG = { id: "s1", title: "벚꽃 엔딩", artist: "버스커 버스커", score: 2, thumbnail_url: null, youtube_video_id: "v1" } as unknown as Props["songs"][number];
const TABS = ["후보곡", "셋리스트", "합주"] as const;

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  // 2026-10-04 12:00 KST
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function openTab(tab: (typeof TABS)[number]) {
  if (tab !== "후보곡") fireEvent.click(screen.getByRole("button", { name: tab }));
}

describe("PlaylistClient top row (#101)", () => {
  // The 밴드 홈 tab is the way to the band now (#106), so the row only says where the playlist belongs.
  it.each(TABS)("gives a band member the same top row on the %s tab: the band and its D-day as text, account on the right", (tab) => {
    renderRoom({ team: { ...band, nextShowAt: "2026-10-16" } });
    openTab(tab);

    const top = within(screen.getByRole("banner"));
    expect(top.getByText("일코해제")).toBeInTheDocument();
    expect(top.getByText("공연 D-12")).toBeInTheDocument();
    expect(top.queryByRole("link")).not.toBeInTheDocument();
    expect(top.getByRole("button", { name: "보컬 계정 메뉴" })).toBeInTheDocument();
  });

  it.each(TABS)("gives a logged-out viewer outside the band no back chevron, only the login button, on the %s tab", (tab) => {
    renderRoom({ team: null, loggedIn: false, isHost: false, userNickname: undefined });
    openTab(tab);

    const top = within(screen.getByRole("banner"));
    expect(top.queryByRole("link")).not.toBeInTheDocument();
    expect(top.getByRole("button", { name: "로그인" })).toHaveAttribute("data-variant", "tonal");
    expect(screen.getAllByRole("button", { name: "로그인" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /계정 메뉴/ })).not.toBeInTheDocument();
  });

  it.each(["후보곡", "합주"] as const)("names the playlist in the one h1 of the %s tab", (tab) => {
    renderRoom();
    openTab(tab);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "10월 합주" })).toBeInTheDocument();
  });

  it("leaves the login button out of the top row for a logged-in member", () => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(within(screen.getByRole("banner")).queryByRole("button", { name: "로그인" })).not.toBeInTheDocument();
  });
});

describe("PlaylistClient first tab (#106)", () => {
  const firstTab = () => within(screen.getByRole("navigation", { name: "플레이리스트 화면" })).getAllByRole("link")[0];

  it("takes a band member to the band home", () => {
    renderRoom();

    expect(firstTab()).toHaveAccessibleName("밴드 홈");
    expect(firstTab()).toHaveAttribute("href", `/band/${TEAM}`);
  });

  it.each([
    ["the host of a band playlist who is not in the band", { team: { id: null, name: "일코해제", nextShowAt: null, isMember: false } }],
    ["a member of the playlist outside its band", { isHost: false, team: { id: null, name: null, nextShowAt: null, isMember: false } }],
    ["a logged-out visitor", { isHost: false, loggedIn: false, userNickname: undefined, team: { id: null, name: null, nextShowAt: null, isMember: false } }],
    ["anyone on a playlist with no band", { team: null }],
  ])("gives %s 홈, to the app home", (_who, overrides) => {
    renderRoom(overrides);

    expect(firstTab()).toHaveAccessibleName("홈");
    expect(firstTab()).toHaveAttribute("href", "/");
  });
});

describe("PlaylistClient candidates action row (#101)", () => {
  it("puts the list/card view toggle in the ⋯ sheet, not in the row", () => {
    renderRoom({ songs: [SONG] });
    expect(screen.queryByRole("button", { name: "카드 보기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "카드 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 메뉴" }));

    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "리스트 보기" })).toBeInTheDocument();
  });

  it("draws no ⋯ before the first song, when there is no view to switch", () => {
    renderRoom();
    expect(screen.queryByRole("button", { name: "플레이리스트 메뉴" })).not.toBeInTheDocument();
  });

  it("gives the host an edit glyph that opens the playlist settings, and the menu no second way there", () => {
    renderRoom({ songs: [SONG] });
    expect(screen.getByRole("button", { name: "플레이리스트 설정" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 메뉴" }));
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "플레이리스트 설정" })).not.toBeInTheDocument();
  });

  it.each([
    ["a member who is not the host", { isHost: false }],
    ["a logged-out visitor", { isHost: false, loggedIn: false, userNickname: undefined, team: null }],
  ])("leaves the edit glyph out for %s", (_who, overrides) => {
    renderRoom({ songs: [SONG], ...overrides });
    expect(screen.queryByRole("button", { name: "플레이리스트 설정" })).not.toBeInTheDocument();
  });
});

describe("PlaylistClient header per tab (#4)", () => {
  it("keeps the cover header with share, notice and menu on the candidates tab", () => {
    renderRoom({ songs: [SONG] });

    for (const action of roomActions()) expect(action).toBeInTheDocument();
  });

  it("leaves the cover header's share, notice and menu out of the 합주 tab", () => {
    renderRoom({ songs: [SONG] });
    fireEvent.click(screen.getByRole("button", { name: "합주" }));

    for (const action of roomActions()) expect(action).not.toBeInTheDocument();
  });

  // The 셋리스트 tab has a notice and ⋯ of its own, in SetlistView's row (SetlistView.header.test). Only the vote invite
  // belongs to the candidates header alone.
  it("leaves the candidates' 카카오톡 공유 vote invite off the 셋리스트 tab", () => {
    renderRoom({ songs: [SONG] });
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(screen.queryByRole("button", { name: "카카오톡 공유" })).not.toBeInTheDocument();
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
    renderRoom({ songs: [SONG] });
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
    fireEvent.click(screen.getByRole("button", { name: "후보곡" }));

    for (const action of roomActions()) expect(action).toBeInTheDocument();
  });
});
