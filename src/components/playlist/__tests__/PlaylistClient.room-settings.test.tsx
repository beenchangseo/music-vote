// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, SetlistItem, SongWithScore } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

// Another screen learns about a change by a content-free broadcast, then refetches (ADR 0010).
// router.refresh() hands PlaylistClient a new `playlist` prop; rerender() stands in for that refetch.
const broadcast = vi.fn();
const updateSetlistEditMode = vi.fn();
const showAlert = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      const channel = {
        on: () => channel,
        subscribe: () => channel,
        send: (message: unknown) => {
          broadcast(name, message);
          return Promise.resolve("ok");
        },
      };
      return channel;
    },
    removeChannel: vi.fn(),
  }),
}));
vi.mock("@/actions/playlist", () => ({
  updateSetlistEditMode: (...args: unknown[]) => updateSetlistEditMode(...args),
  resetPlaylistVotes: vi.fn(),
  deletePlaylist: vi.fn(),
}));
vi.mock("@/actions/member", () => ({
  registerPlaylistMember: vi.fn().mockResolvedValue(null),
  getVotingSettings: vi.fn().mockResolvedValue({
    mode: "free",
    votesAnonymous: true,
    defaultVoteLimit: 3,
    members: [],
    totalVotes: 0,
  }),
  saveVotingSettings: vi.fn(),
}));
vi.mock("@/actions/team", () => ({ attachPlaylistToTeam: vi.fn(), createTeamFromPlaylist: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ getSetlistItems: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/comment", () => ({ getComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/song", () => ({ removeSong: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({
  useDialog: () => ({ showAlert: (...args: unknown[]) => showAlert(...args), showConfirm: vi.fn(), showDanger: vi.fn() }),
}));
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
vi.mock("../PlaylistHeader", () => ({
  default: ({ onOpenSettings }: { onOpenSettings?: () => void }) =>
    onOpenSettings ? (
      <button type="button" onClick={onOpenSettings}>
        플레이리스트 설정
      </button>
    ) : null,
}));
vi.mock("../NavigationBar", () => ({
  default: ({ onModeChange }: { onModeChange: (mode: string) => void }) => (
    <nav>
      <button type="button" onClick={() => onModeChange("setlist")}>셋리스트</button>
    </nav>
  ),
}));
vi.mock("../AddSongForm", () => ({ default: () => null }));
vi.mock("../MiniPlayer", () => ({ default: () => null }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
vi.mock("../VoteButtons", () => ({ default: () => null }));
vi.mock("../CommentModal", () => ({ default: () => null }));
vi.mock("../SongVersionModal", () => ({ default: () => null }));
vi.mock("../../rehearsal/RehearsalView", () => ({ default: () => null }));
vi.mock("../../auth/LoginButton", () => ({ default: () => null }));

const OWNER = "user-owner";
const MEMBER = "user-member";
const HOST_ONLY_NOTICE = "방장만 편집할 수 있어요";

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
  setlist_edit_mode: "host_only",
  created_at: "2026-10-01T00:00:00Z",
  team_id: null,
};

const song = {
  id: "song-1",
  playlist_id: playlist.id,
  title: "Plastic Love",
  artist: "Mariya Takeuchi",
  youtube_url: "https://youtu.be/abcdefghijk",
  youtube_video_id: "abcdefghijk",
  thumbnail_url: null,
  added_by: "보컬",
  added_by_user_id: OWNER,
  key_memo: null,
  key_root: null,
  key_mode: null,
  tempo_bpm: null,
  duration_seconds: 300,
  difficulty: null,
  genre: null,
  created_at: "2026-10-01T00:00:00Z",
  score: 1,
  votes: [],
  userVote: null,
  userVoteCount: 0,
  commentCount: 0,
  versionCount: 1,
} satisfies SongWithScore;

const item = {
  id: "item-1",
  playlist_id: playlist.id,
  position: 0,
  item_type: "song",
  song_id: song.id,
  label: null,
  description: null,
  duration_seconds: 0,
  title_override: null,
  duration_override_seconds: null,
  created_at: "",
} as SetlistItem;

type Props = Parameters<typeof PlaylistClient>[0];

function ui(overrides: Partial<Props> = {}) {
  return (
    <PlaylistClient
      playlist={playlist}
      songs={[song]}
      shareCode="abc123"
      participantCount={2}
      userNickname="기타"
      currentUserId={MEMBER}
      initialSetlistItems={[item]}
      {...overrides}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
  broadcast.mockReset();
  showAlert.mockReset();
  updateSetlistEditMode.mockReset().mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe("an open member screen follows the host's setlist permission", () => {
  it("unlocks editing when a refetch brings 'everyone'", () => {
    const { rerender } = render(ui({ playlist: { ...playlist, setlist_edit_mode: "host_only" } }));
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
    expect(screen.getByText(HOST_ONLY_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집" })).not.toBeInTheDocument();

    rerender(ui({ playlist: { ...playlist, setlist_edit_mode: "everyone" } }));

    expect(screen.queryByText(HOST_ONLY_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "편집" })).toBeInTheDocument();
  });

  it("locks editing when a refetch brings 'host_only'", () => {
    const { rerender } = render(ui({ playlist: { ...playlist, setlist_edit_mode: "everyone" } }));
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
    expect(screen.getByRole("button", { name: "편집" })).toBeInTheDocument();

    rerender(ui({ playlist: { ...playlist, setlist_edit_mode: "host_only" } }));

    expect(screen.getByText(HOST_ONLY_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집" })).not.toBeInTheDocument();
  });
});

describe("the host saving the setlist permission", () => {
  it("tells the other open screens to refetch once the save lands", async () => {
    render(ui({ currentUserId: OWNER, userNickname: "보컬", playlist: { ...playlist, setlist_edit_mode: "everyone" } }));
    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 설정" }));
    fireEvent.click(await screen.findByRole("button", { name: "방장만 편집" }));

    await waitFor(() =>
      expect(updateSetlistEditMode).toHaveBeenCalledWith(playlist.id, null, "host_only", "abc123"),
    );
    await waitFor(() =>
      expect(broadcast).toHaveBeenCalledWith("playlist:abc123", { type: "broadcast", event: "playlist_changed", payload: {} }),
    );
  });

  it("stays quiet when the save fails", async () => {
    updateSetlistEditMode.mockRejectedValue(new Error("권한 없음"));
    render(ui({ currentUserId: OWNER, userNickname: "보컬", playlist: { ...playlist, setlist_edit_mode: "everyone" } }));
    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 설정" }));
    fireEvent.click(await screen.findByRole("button", { name: "방장만 편집" }));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith("권한 없음"));
    expect(screen.getByRole("button", { name: "모두 편집" })).toHaveAttribute("aria-pressed", "true");
    expect(broadcast).not.toHaveBeenCalled();
  });
});

describe("an open member screen follows the host's vote visibility", () => {
  it("shows who voted when a refetch switches the room to named votes", () => {
    const { rerender } = render(ui({ playlist: { ...playlist, votes_anonymous: true } }));
    fireEvent.click(screen.getByRole("button", { name: /Plastic Love/, expanded: false }));
    expect(screen.queryByRole("button", { name: "투표한 사람 보기" })).not.toBeInTheDocument();

    rerender(
      ui({
        playlist: { ...playlist, votes_anonymous: false },
        songs: [{ ...song, votes: [{ song_id: song.id, vote_type: 1, nickname: "보컬" }] }],
      }),
    );

    expect(screen.getByRole("button", { name: "투표한 사람 보기" })).toBeInTheDocument();
  });
});
