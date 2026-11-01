// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSetlistItems } from "@/lib/playlist-refetch";
import { removeSetlistItem } from "@/actions/setlist";
import type { Playlist, SetlistItem, SongWithScore } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

const realtime = vi.hoisted(() => ({ onRemoteChange: (): Promise<void> | void => {}, notifyChange: vi.fn(), requestRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: async () => true }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/playlist-refetch", () => ({ fetchSetlistItems: vi.fn(), fetchComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/setlist", () => ({ removeSetlistItem: vi.fn() }));
vi.mock("@/hooks/usePlaylistRealtime", () => ({
  usePlaylistRealtime: (_shareCode: string, onRemoteChange: () => Promise<void> | void) => {
    realtime.onRemoteChange = onRemoteChange;
    return { notifyChange: realtime.notifyChange, requestRefresh: realtime.requestRefresh };
  },
}));
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
  default: ({ song, onRemoveFromSetlist }: { song: SongWithScore; onRemoveFromSetlist?: (songId: string) => void }) => (
    <button type="button" onClick={() => onRemoveFromSetlist?.(song.id)}>
      {song.title} 셋리에서 빼기
    </button>
  ),
}));
vi.mock("../MiniPlayer", () => ({ default: () => null }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
vi.mock("../RoomSettingsButton", () => ({ default: () => null }));
vi.mock("../../rehearsal/RehearsalView", () => ({ default: () => null }));
vi.mock("../../auth/LoginButton", () => ({ default: () => null }));
vi.mock("../NavigationBar", () => ({
  default: ({ onModeChange }: { onModeChange: (mode: string) => void }) => (
    <button type="button" onClick={() => onModeChange("setlist")}>
      셋리스트
    </button>
  ),
}));
vi.mock("../../setlist/SetlistView", () => ({
  default: ({ setlistItems, onItemsChange }: { setlistItems: SetlistItem[]; onItemsChange: (items: SetlistItem[] | ((items: SetlistItem[]) => SetlistItem[])) => void }) => (
    <div>
      <p data-testid="setlist">{setlistItems.map((item) => item.id).join(",")}</p>
      <button type="button" onClick={() => onItemsChange((items) => items.filter((item) => item.id !== "theirs"))}>
        함수 쓰기
      </button>
    </div>
  ),
}));

const item = (id: string) => ({ id, playlist_id: "p", position: 0, item_type: "interval", song_id: null, label: id, description: null, duration_seconds: 60, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

const candidate = { id: "song-1", title: "Plastic Love", artist: "Mariya Takeuchi", youtube_video_id: "abcdefghijk", thumbnail_url: null, score: 0, votes: [], commentCount: 0, versionCount: 1 } as unknown as SongWithScore;

const playlist = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "10월 합주",
  share_code: "abc123",
  deadline: null,
  setlist_count: null,
  announcement: null,
  setlist_confirmed: false,
  creator_nickname: "보컬",
  creator_user_id: "owner",
  votes_anonymous: true,
  voting_mode: "free",
  default_vote_limit: 3,
  setlist_edit_mode: "everyone",
  created_at: "2026-10-01T00:00:00Z",
  team_id: null,
} as Playlist;

const shown = () => screen.getByTestId("setlist").textContent;

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(fetchSetlistItems).mockReset();
  vi.mocked(removeSetlistItem).mockReset();
});

describe("PlaylistClient function updater vs read numbering", () => {
  it("a read in flight when a null-items delete lands is discarded, even though the write came as a function", async () => {
    const inSetlist = { ...item("candidate"), item_type: "song", song_id: candidate.id } as SetlistItem;
    render(<PlaylistClient playlist={playlist} songs={[candidate]} shareCode="abc123" participantCount={2} userNickname="보컬" currentUserId="owner" team={null} initialSetlistItems={[inSetlist, item("theirs")]} />);
    let landStale: (items: SetlistItem[]) => void = () => {};
    vi.mocked(fetchSetlistItems).mockReturnValueOnce(new Promise((resolve) => (landStale = resolve))).mockReturnValue(new Promise(() => {}));
    vi.mocked(removeSetlistItem).mockResolvedValue({ success: true, items: null });

    act(() => {
      void realtime.onRemoteChange();
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Plastic Love 셋리에서 빼기" })));
    await act(async () => landStale([inSetlist, item("theirs"), item("stale")]));
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(shown()).toBe("theirs");
    expect(fetchSetlistItems).toHaveBeenCalledTimes(2);
  });

  it("a function write from the setlist tab applies to the list a read drew after the click, and a read that then lands late is discarded", async () => {
    render(<PlaylistClient playlist={playlist} songs={[]} shareCode="abc123" participantCount={2} userNickname="보컬" currentUserId="owner" team={null} initialSetlistItems={[item("first"), item("theirs")]} />);
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
    let landLate: (items: SetlistItem[]) => void = () => {};
    vi.mocked(fetchSetlistItems)
      .mockReturnValueOnce(new Promise((resolve) => (landLate = resolve)))
      .mockResolvedValueOnce([item("first"), item("theirs"), item("new")])
      .mockReturnValue(new Promise(() => {}));

    act(() => {
      void realtime.onRemoteChange();
    });
    await act(async () => {
      await realtime.onRemoteChange();
    });
    expect(shown()).toBe("first,theirs,new");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "함수 쓰기" })));
    expect(shown()).toBe("first,new");

    await act(async () => landLate([item("first"), item("theirs")]));
    expect(shown()).toBe("first,new");
    expect(fetchSetlistItems).toHaveBeenCalledTimes(3);
  });
});
