// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, RoomTeam } from "@/lib/types";
import PlaylistClient from "../PlaylistClient";

// Everything around the band slot is stubbed: this file is about the prompt card (F7, 27A)
// and the success card that must survive the action's revalidation (R6, D30A).
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/actions/setlist", () => ({ getSetlistItems: vi.fn().mockResolvedValue([]), confirmSetlist: vi.fn(), addSongToSetlist: vi.fn() }));
vi.mock("@/actions/comment", () => ({ getComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/hooks/usePlaylistRealtime", () => ({ usePlaylistRealtime: () => ({ notifyChange: vi.fn() }) }));
vi.mock("@/hooks/usePlaylistVotes", () => ({
  usePlaylistVotes: ({ songs }: { songs: unknown[] }) => ({
    songsWithVotes: songs,
    pressVote: vi.fn(),
    isVotePending: () => false,
    resetVotes: vi.fn(),
  }),
}));
vi.mock("@/hooks/usePlayerQueue", () => ({
  usePlayerQueue: () => ({
    state: { currentSongId: null, currentSong: null, isPlaying: false, repeatMode: "off" },
    actions: { playNext: vi.fn(), playSong: vi.fn(), setIsPlaying: vi.fn() },
  }),
}));
vi.mock("../FilterBar", () => ({ DEFAULT_FILTER: {}, songMatchesFilter: () => true }));
vi.mock("../PlaylistHeader", () => ({ default: () => null }));
vi.mock("../AddSongForm", () => ({ default: () => null }));
vi.mock("../SongCard", () => ({ default: () => null }));
vi.mock("../MiniPlayer", () => ({ default: () => null }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
vi.mock("../SetlistView", () => ({ default: () => null }));
vi.mock("../RehearsalView", () => ({ default: () => null }));
vi.mock("../RoomSettingsButton", () => ({ default: () => null }));
vi.mock("../LoginButton", () => ({ default: () => null }));
vi.mock("../NavigationBar", () => ({
  default: ({ onModeChange }: { onModeChange: (mode: string) => void }) => (
    <nav>
      <button type="button" onClick={() => onModeChange("playlist")}>후보곡</button>
      <button type="button" onClick={() => onModeChange("setlist")}>셋리스트</button>
      <button type="button" onClick={() => onModeChange("rehearsal")}>합주</button>
    </nav>
  ),
}));
// The sheet's own behaviour is covered in RoomSettingsButton.test; here it just "succeeds".
vi.mock("../CreateBandSheet", () => ({
  default: ({ open, onCreated }: { open: boolean; onCreated: (band: unknown) => void }) =>
    open ? (
      <button
        type="button"
        onClick={() => onCreated({ teamId: TEAM, name: "일코해제", inviteCode: "aB3_x-9Zq0", memberCount: 3 })}
      >
        시트에서 만들기
      </button>
    ) : null,
}));
vi.mock("../BandInviteSheet", () => ({
  default: ({ open, inviteCode }: { open: boolean; inviteCode: string }) =>
    open ? <div role="dialog" aria-label="멤버 초대">{`/join/${inviteCode}`}</div> : null,
  KakaoInviteButton: ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const TEAM = "11111111-1111-4111-8111-111111111111";
const OWNER = "user-owner";
const PROMPT = /이 멤버 그대로 다음 공연도 해요/;

const playlist: Playlist = {
  id: "room-1",
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
  team_id: null,
};

const bandTeam: RoomTeam = { id: TEAM, name: "일코해제", nextShowAt: null, isMember: true };

type Props = Parameters<typeof PlaylistClient>[0];

function ui(overrides: Partial<Props> = {}) {
  return (
    <PlaylistClient
      playlist={playlist}
      songs={[]}
      shareCode="abc123"
      participantCount={0}
      userNickname="보컬"
      currentUserId={OWNER}
      team={null}
      myTeams={[]}
      memberCount={2}
      {...overrides}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PlaylistClient band prompt (F7, 27A)", () => {
  it("shows the card to the owner of a band-less room with two logged-in members", () => {
    render(ui());
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "밴드 이름 정하고 만들기" })).toBeInTheDocument();
  });

  it.each([
    ["a brand-new room with one member", { memberCount: 1 }],
    ["someone who is not the owner", { currentUserId: "user-other" }],
    ["a logged-out visitor", { currentUserId: null }],
    ["a room already in a band", { playlist: { ...playlist, team_id: TEAM }, team: bandTeam, memberCount: null }],
  ])("stays away from %s", (_label, overrides) => {
    render(ui(overrides as Partial<Props>));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("lives on the candidates tab only", () => {
    render(ui());
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "합주" }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "후보곡" }));
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
  });

  it("stays closed in that room after it is dismissed, also after a reload", () => {
    const { unmount } = render(ui());
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    unmount();
    render(ui());
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("still renders, and closes for this visit, when localStorage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(ui());
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });
});

describe("PlaylistClient band success card (R6, D30A)", () => {
  function createFromCard() {
    fireEvent.click(screen.getByRole("button", { name: "밴드 이름 정하고 만들기" }));
    fireEvent.click(screen.getByRole("button", { name: "시트에서 만들기" }));
  }

  it("keeps the success card when the revalidated room arrives with a band", () => {
    const { rerender } = render(ui());
    createFromCard();
    expect(screen.getByRole("status")).toHaveTextContent("밴드를 만들었어요");

    // revalidatePath: same component, new props where the prompt condition is false.
    rerender(ui({ playlist: { ...playlist, team_id: TEAM }, team: bandTeam, memberCount: null }));
    expect(screen.getByRole("status")).toHaveTextContent("밴드를 만들었어요");
    expect(screen.getByRole("link", { name: "밴드 홈" })).toHaveAttribute("href", `/band/${TEAM}`);
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("opens the invite sheet with the new band's link from 카톡으로 알리기", () => {
    render(ui());
    createFromCard();
    fireEvent.click(screen.getByRole("button", { name: "카톡으로 알리기" }));
    expect(screen.getByRole("dialog", { name: "멤버 초대" })).toHaveTextContent("/join/aB3_x-9Zq0");
  });

  it("is gone on a fresh mount (reload)", () => {
    render(ui({ playlist: { ...playlist, team_id: TEAM }, team: bandTeam, memberCount: null }));
    expect(screen.queryByText("밴드를 만들었어요")).not.toBeInTheDocument();
  });

  it("can be dismissed", () => {
    render(ui());
    createFromCard();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByText("밴드를 만들었어요")).not.toBeInTheDocument();
  });
});
