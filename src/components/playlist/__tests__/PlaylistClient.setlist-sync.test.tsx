// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSetlistItems } from "@/actions/setlist";
import type { Playlist, SetlistItem } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

const realtime = vi.hoisted(() => ({ onRemoteChange: () => {}, notifyChange: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/actions/setlist", () => ({ getSetlistItems: vi.fn() }));
vi.mock("@/actions/comment", () => ({ getComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/hooks/usePlaylistRealtime", () => ({
  usePlaylistRealtime: (_shareCode: string, onRemoteChange: () => void) => {
    realtime.onRemoteChange = onRemoteChange;
    return { notifyChange: realtime.notifyChange };
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
vi.mock("../SongCard", () => ({ default: () => null }));
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
  default: ({ setlistItems, onItemsChange }: { setlistItems: SetlistItem[]; onItemsChange: (items: SetlistItem[]) => void }) => (
    <div>
      <p data-testid="setlist">{setlistItems.map((item) => item.id).join(",")}</p>
      <button type="button" onClick={() => onItemsChange([item("mine")])}>
        내 쓰기
      </button>
    </div>
  ),
}));

const item = (id: string) => ({ id, playlist_id: "p", position: 0, item_type: "interval", song_id: null, label: id, description: null, duration_seconds: 60, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

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

function deferred() {
  let resolve: (items: SetlistItem[]) => void = () => {};
  const promise = new Promise<SetlistItem[]>((done) => (resolve = done));
  return { promise, resolve };
}

function openSetlist() {
  render(<PlaylistClient playlist={playlist} songs={[]} shareCode="abc123" participantCount={2} userNickname="보컬" currentUserId="owner" team={null} initialSetlistItems={[item("first")]} />);
  fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));
}

const shown = () => screen.getByTestId("setlist").textContent;

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(getSetlistItems).mockReset();
  realtime.notifyChange.mockReset();
});

describe("PlaylistClient setlist sync", () => {
  it("tells the other screens once a setlist write has landed", () => {
    openSetlist();

    fireEvent.click(screen.getByRole("button", { name: "내 쓰기" }));

    expect(shown()).toBe("mine");
    expect(realtime.notifyChange).toHaveBeenCalledTimes(1);
  });

  it("applies another member's change when nothing of mine landed during the read", async () => {
    openSetlist();
    vi.mocked(getSetlistItems).mockResolvedValue([item("theirs")]);

    await act(async () => realtime.onRemoteChange());

    expect(shown()).toBe("theirs");
  });

  it("drops a read that overlapped my write and reads again, so neither an old list nor their change is lost", async () => {
    openSetlist();
    const overlapped = deferred();
    const again = deferred();
    vi.mocked(getSetlistItems).mockReturnValueOnce(overlapped.promise).mockReturnValueOnce(again.promise);

    act(() => realtime.onRemoteChange());
    fireEvent.click(screen.getByRole("button", { name: "내 쓰기" }));
    await act(async () => overlapped.resolve([item("first")]));

    expect(shown()).toBe("mine");
    expect(getSetlistItems).toHaveBeenCalledTimes(2);

    await act(async () => again.resolve([item("mine"), item("theirs")]));

    expect(shown()).toBe("mine,theirs");
  });
});
