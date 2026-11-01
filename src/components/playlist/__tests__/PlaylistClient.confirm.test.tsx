// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSetlist } from "@/actions/setlist";
import { fetchSetlistItems } from "@/lib/playlist-refetch";
import { track } from "@/lib/analytics";
import { setlistMessage } from "@/lib/setlist-messages";
import type { Playlist, SetlistItem, SongWithScore } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

const dialog = vi.hoisted(() => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }));
const realtime = vi.hoisted(() => ({ notifyChange: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => dialog }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/playlist-refetch", () => ({ fetchSetlistItems: vi.fn(), fetchComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/setlist", () => ({ confirmSetlist: vi.fn(), insertSetlistBlock: vi.fn(), removeSetlistItem: vi.fn() }));
vi.mock("@/hooks/usePlaylistRealtime", () => ({ usePlaylistRealtime: () => ({ notifyChange: realtime.notifyChange }) }));
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
vi.mock("../../share/KakaoShareButton", () => ({ default: () => null }));
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
  default: ({ setlistItems }: { setlistItems: SetlistItem[] }) => <p data-testid="setlist">{setlistItems.map((entry) => entry.song_id ?? entry.label).join(",")}</p>,
}));

const block = (songId: string, position: number) =>
  ({ id: `block-${songId}`, playlist_id: "p", position, item_type: "song", song_id: songId, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

const labeledBlock = (itemType: "interval" | "original", label: string, position: number) =>
  ({ id: `block-${label}`, playlist_id: "p", position, item_type: itemType, song_id: null, label, description: null, duration_seconds: 60, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

const song = (id: string) => ({ id, title: id, artist: null, score: 0 }) as unknown as SongWithScore;

const playlist = {
  id: "p",
  title: "10월 합주",
  share_code: "abc123",
  deadline: "2026-10-01T00:00:00Z",
  setlist_count: 2,
  announcement: null,
  setlist_confirmed: false,
  creator_nickname: "보컬",
  creator_user_id: "owner",
  votes_anonymous: true,
  voting_mode: "free",
  default_vote_limit: 3,
  setlist_edit_mode: "host_only",
  created_at: "2026-09-01T00:00:00Z",
  team_id: null,
} as Playlist;

async function confirmAsHost(initialSetlistItems: SetlistItem[] = []) {
  render(<PlaylistClient playlist={playlist} songs={[song("top"), song("second"), song("third")]} shareCode="abc123" participantCount={2} userNickname="보컬" currentUserId="owner" team={null} initialSetlistItems={initialSetlistItems} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "셋리스트 확정하기" })));
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  // The confirm button still needs the creator's link token on this device.
  localStorage.setItem("myPlaylists", JSON.stringify([{ id: "p", shareCode: "abc123", adminToken: "token" }]));
  dialog.showConfirm.mockResolvedValue(true);
  vi.mocked(fetchSetlistItems).mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("PlaylistClient setlist confirm", () => {
  it("asks for the top songs on an empty setlist and draws the setlist the server confirmed without a reload", async () => {
    vi.mocked(confirmSetlist).mockResolvedValue({ success: true, items: [block("top", 0), block("second", 1)] });

    await confirmAsHost();
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(dialog.showConfirm).toHaveBeenCalledWith("상위 2곡으로 셋리스트를 확정하시겠습니까?");
    expect(confirmSetlist).toHaveBeenCalledWith("p", "token", ["top", "second"], "abc123");
    expect(screen.getByTestId("setlist")).toHaveTextContent("top,second");
    expect(realtime.notifyChange).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("setlist_confirmed", { song_count: 2, auto: false });
  });

  it("asks to confirm the setlist as it is when it already has blocks, and counts the songs the server kept", async () => {
    const made = [labeledBlock("interval", "멘트", 0), block("third", 1)];
    // Another member added an original before the confirm took the lock.
    vi.mocked(confirmSetlist).mockResolvedValue({ success: true, items: [...made, labeledBlock("original", "자작곡", 2)] });

    await confirmAsHost(made);
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(dialog.showConfirm).toHaveBeenCalledWith("지금 셋리스트로 확정할까요?");
    expect(dialog.showAlert).not.toHaveBeenCalled();
    expect(screen.getByTestId("setlist")).toHaveTextContent("멘트,third,자작곡");
    expect(track).toHaveBeenCalledWith("setlist_confirmed", { song_count: 2, auto: false });
  });

  it("confirms nothing when the host cancels the question", async () => {
    dialog.showConfirm.mockResolvedValue(false);

    await confirmAsHost([block("third", 0)]);

    expect(confirmSetlist).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith("setlist_confirmed", expect.anything());
  });

  it("tells the host why a confirm was refused, and counts no confirm", async () => {
    vi.mocked(confirmSetlist).mockResolvedValue({ success: false, reason: "song_not_found" });

    await confirmAsHost();

    expect(dialog.showAlert).toHaveBeenCalledWith(setlistMessage("song_not_found"));
    expect(track).not.toHaveBeenCalledWith("setlist_confirmed", expect.anything());
    expect(realtime.notifyChange).not.toHaveBeenCalled();
  });
});
