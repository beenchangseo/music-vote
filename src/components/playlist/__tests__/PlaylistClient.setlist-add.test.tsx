// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertSetlistBlock } from "@/actions/setlist";
import type { PlaylistView, SetlistItem, SongWithScore } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/playlist-refetch", () => ({ fetchSetlistItems: vi.fn(() => new Promise(() => {})), fetchComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/setlist", () => ({ insertSetlistBlock: vi.fn() }));
vi.mock("@/hooks/usePlaylistRealtime", () => ({ usePlaylistRealtime: () => ({ notifyChange: vi.fn(), requestRefresh: vi.fn() }) }));
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
vi.mock("../SongCard", () => ({
  default: ({ song, onAddToSetlist }: { song: SongWithScore; onAddToSetlist?: (songId: string) => void }) => (
    <button type="button" onClick={() => onAddToSetlist?.(song.id)}>
      {song.title} 셋리에 넣기
    </button>
  ),
}));
vi.mock("../MiniPlayer", () => ({ default: () => null }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
vi.mock("../RoomSettingsButton", () => ({ default: () => null }));
vi.mock("../../rehearsal/RehearsalView", () => ({ default: () => null }));
vi.mock("../../auth/LoginButton", () => ({ default: () => null }));
vi.mock("../NavigationBar", () => ({ default: () => null }));
vi.mock("../../setlist/SetlistView", () => ({ default: () => null }));

const candidate = { id: "song-1", title: "Plastic Love", artist: "Mariya Takeuchi", youtube_video_id: "abcdefghijk", thumbnail_url: null, score: 0, votes: [], commentCount: 0, versionCount: 0 } as unknown as SongWithScore;
const added = { id: "item-1", playlist_id: "p", position: 0, item_type: "song", song_id: "song-1", label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" } as SetlistItem;

const playlist = {
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
  team_id: null,
} as PlaylistView;

function openAddSheet() {
  render(<PlaylistClient playlist={playlist} songs={[candidate]} shareCode="abc123" participantCount={2} userNickname="보컬" loggedIn isHost team={null} initialSetlistItems={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Plastic Love 셋리에 넣기" }));
  return screen.getByRole("dialog", { name: "셋리스트에 추가할까요?" });
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(insertSetlistBlock).mockReset();
});

describe("PlaylistClient setlist add sheet", () => {
  it("adds the song once however many times 추가하기 is pressed, then closes", async () => {
    let land: (value: Awaited<ReturnType<typeof insertSetlistBlock>>) => void = () => {};
    vi.mocked(insertSetlistBlock).mockReturnValue(new Promise((done) => (land = done)));
    const sheet = openAddSheet();

    const add = screen.getByRole("button", { name: "추가하기" });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(insertSetlistBlock).toHaveBeenCalledTimes(1);
    expect(insertSetlistBlock).toHaveBeenCalledWith(playlist.id, { before: null }, { kind: "song", songId: "song-1" }, "abc123");

    await act(async () => land({ success: true, itemId: added.id, items: [added] }));
    expect(sheet).not.toBeInTheDocument();
  });

  it("adds nothing when the sheet is closed", () => {
    openAddSheet();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "셋리스트에 추가할까요?" })).not.toBeInTheDocument();
    expect(insertSetlistBlock).not.toHaveBeenCalled();
  });
});
