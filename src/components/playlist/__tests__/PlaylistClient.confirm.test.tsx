// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSetlist } from "@/actions/setlist";
import { fetchSetlistItems } from "@/lib/playlist-refetch";
import { track } from "@/lib/analytics";
import { setlistMessage } from "@/lib/setlist-messages";
import type { PlaylistView, SetlistItem, SongWithScore } from "@/domain/types";
import PlaylistClient from "../PlaylistClient";

const dialog = vi.hoisted(() => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }));
const realtime = vi.hoisted(() => ({ onRemoteChange: (): Promise<void> | void => {}, notifyChange: vi.fn(), requestRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/playlist/abc123" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => dialog }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/member", () => ({ registerPlaylistMember: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/playlist-refetch", () => ({ fetchSetlistItems: vi.fn(), fetchComments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/setlist", () => ({ confirmSetlist: vi.fn(), insertSetlistBlock: vi.fn(), removeSetlistItem: vi.fn() }));
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
  archived: false,
  votes_anonymous: true,
  voting_mode: "free",
  default_vote_limit: 3,
  setlist_edit_mode: "host_only",
  created_at: "2026-09-01T00:00:00Z",
  team_id: null,
} as PlaylistView;

function renderAsHost(initialSetlistItems: SetlistItem[] = []) {
  render(<PlaylistClient playlist={playlist} songs={[song("top"), song("second"), song("third")]} shareCode="abc123" participantCount={2} userNickname="보컬" loggedIn isHost team={null} initialSetlistItems={initialSetlistItems} />);
}

const clickConfirm = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "셋리스트 확정하기" })));

async function confirmAsHost(initialSetlistItems: SetlistItem[] = []) {
  renderAsHost(initialSetlistItems);
  await clickConfirm();
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
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
    expect(confirmSetlist).toHaveBeenCalledWith("p", ["top", "second"], "abc123");
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

  it("keeps the confirmed setlist when a read that started before the confirm lands after it", async () => {
    let landBefore: (items: SetlistItem[]) => void = () => {};
    vi.mocked(fetchSetlistItems).mockReturnValueOnce(new Promise((resolve) => (landBefore = resolve)));
    vi.mocked(confirmSetlist).mockResolvedValue({ success: true, items: [block("top", 0), block("second", 1)] });

    renderAsHost();
    act(() => {
      void realtime.onRemoteChange();
    });
    await clickConfirm();
    await act(async () => landBefore([]));
    fireEvent.click(screen.getByRole("button", { name: "셋리스트" }));

    expect(screen.getByTestId("setlist")).toHaveTextContent("top,second");
    expect(fetchSetlistItems).toHaveBeenCalledTimes(2);
  });

  it("confirms nothing when the host cancels the question", async () => {
    dialog.showConfirm.mockResolvedValue(false);

    await confirmAsHost([block("third", 0)]);

    expect(confirmSetlist).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith("setlist_confirmed", expect.anything());
  });

  it("lets the host confirm from a device that never stored the link token", async () => {
    vi.mocked(confirmSetlist).mockResolvedValue({ success: true, items: [block("top", 0), block("second", 1)] });

    await confirmAsHost();

    expect(dialog.showConfirm).toHaveBeenCalledWith("상위 2곡으로 셋리스트를 확정하시겠습니까?");
    expect(confirmSetlist).toHaveBeenCalledWith("p", ["top", "second"], "abc123");
  });

  it("offers no confirm in an archived playlist, even on the device that made it", () => {
    localStorage.setItem("myPlaylists", JSON.stringify([{ id: "p", shareCode: "abc123", adminToken: "token" }]));
    render(<PlaylistClient playlist={{ ...playlist, archived: true }} songs={[song("top"), song("second")]} shareCode="abc123" participantCount={2} userNickname="보컬" loggedIn isHost={false} team={null} initialSetlistItems={[]} />);

    expect(screen.queryByRole("button", { name: "셋리스트 확정하기" })).not.toBeInTheDocument();
  });

  it("offers no confirm to a logged-in member the page did not mark as host", () => {
    render(<PlaylistClient playlist={playlist} songs={[song("top"), song("second")]} shareCode="abc123" participantCount={2} userNickname="기타" loggedIn isHost={false} team={null} initialSetlistItems={[]} />);

    expect(screen.queryByRole("button", { name: "셋리스트 확정하기" })).not.toBeInTheDocument();
    // The 셋리스트 and 합주 tabs open before a confirm too, so the line only says who confirms (#80).
    expect(screen.getByText("셋리스트는 방장이 확정해요")).toBeInTheDocument();
  });

  it.each([
    ["not_host", "방장만 셋리스트를 확정할 수 있어요"],
    ["not_logged_in", "로그인이 필요해요. 카카오로 로그인해 주세요"],
    ["archived", "보관된 플레이리스트예요. 지난 기록은 그대로 볼 수 있지만 새로 쓸 수는 없어요."],
    ["playlist_not_found", "플레이리스트를 찾을 수 없어요"],
  ] as const)("tells the host the server refused with %s", async (reason, message) => {
    vi.mocked(confirmSetlist).mockResolvedValue({ success: false, reason });

    await confirmAsHost();

    expect(dialog.showAlert).toHaveBeenCalledWith(message);
  });

  it("tells the host why a confirm was refused, and counts no confirm", async () => {
    vi.mocked(confirmSetlist).mockResolvedValue({ success: false, reason: "song_not_found" });

    await confirmAsHost();

    expect(dialog.showAlert).toHaveBeenCalledWith(setlistMessage("song_not_found"));
    expect(track).not.toHaveBeenCalledWith("setlist_confirmed", expect.anything());
    expect(realtime.notifyChange).not.toHaveBeenCalled();
  });
});

describe("PlaylistClient confirmed banner", () => {
  const confirmed = { ...playlist, setlist_confirmed: true } as PlaylistView;
  const renderConfirmed = (songs: SongWithScore[], initialSetlistItems: SetlistItem[] | null, setlistCount: number | null = 2) =>
    render(<PlaylistClient playlist={{ ...confirmed, setlist_count: setlistCount }} songs={songs} shareCode="abc123" participantCount={0} userNickname="기타" loggedIn isHost={false} team={null} initialSetlistItems={initialSetlistItems} />);

  const sendDefault = vi.fn();
  beforeEach(() => {
    window.Kakao = { isInitialized: () => true, Share: { sendDefault } };
  });
  afterEach(() => {
    delete window.Kakao;
  });

  const bannerLine = () => screen.getByText(/다음 공연 준비 완료/).textContent;

  function sharedSetlistCard() {
    fireEvent.click(screen.getByText("셋리스트 카톡 공유"));
    const { content } = sendDefault.mock.calls[0][0] as { content: { title: string; description: string; imageUrl: string } };
    const image = new URL(content.imageUrl).searchParams;
    return { title: content.title, description: content.description, imageStage: image.get("stage"), imageCount: image.get("setlistCount") };
  }

  const fiveCandidates = ["a", "b", "c", "d", "e"].map(song);
  // Three songs and an original; the interval and the block whose song was deleted are not songs of the setlist.
  const handBuilt = [block("a", 0), labeledBlock("interval", "멘트", 1), labeledBlock("original", "자작곡", 2), block("c", 3), { ...block("gone", 4), song_id: null }, block("e", 5)];

  it.each([
    ["a target of 2 songs", 2],
    ["no target", null],
  ])("counts the songs of the setlist the band built, not %s or the 5 candidates, on the banner and the Kakao card", (_case, setlistCount) => {
    renderConfirmed(fiveCandidates, handBuilt, setlistCount);

    expect(bannerLine()).toBe("총 4곡 · 다음 공연 준비 완료");
    expect(sharedSetlistCard()).toEqual({
      title: "🎵 셋리스트 확정 — 10월 합주",
      description: "총 4곡 · 다음 공연 준비 완료",
      imageStage: "confirmed",
      imageCount: "4",
    });
  });

  it("states the show's length on the Kakao card once every block has one", () => {
    renderConfirmed(fiveCandidates.map((candidate) => ({ ...candidate, duration_seconds: 200 })), handBuilt);

    // Three songs of 200 s, the 멘트 and the 자작곡 of 60 s each: 12 minutes.
    expect(sharedSetlistCard().description).toBe("총 4곡 · 12분 · 다음 공연 준비 완료");
  });

  // The host deletes a candidate from the 후보곡 tab: the server drops its setlist row, but this screen keeps the setlist
  // it loaded. Count what the setlist tab and the exports draw, not the stale row.
  it("leaves out a block whose candidate the host just deleted, as the setlist tab and the exports do", () => {
    renderConfirmed(fiveCandidates.filter((candidate) => candidate.id !== "c"), handBuilt);

    expect(bannerLine()).toBe("총 3곡 · 다음 공연 준비 완료");
    expect(sharedSetlistCard()).toMatchObject({ description: "총 3곡 · 다음 공연 준비 완료", imageCount: "3" });
  });

  it("says the setlist is confirmed when it has blocks, 자작곡 included", () => {
    renderConfirmed([], [labeledBlock("original", "자작곡", 0)]);
    expect(screen.getByText(/셋리스트 확정/)).toBeInTheDocument();
  });

  // The cron confirms an expired playlist with no songs only to take it off its queue (auto-confirm-setlist).
  it("does not call an empty setlist confirmed", () => {
    renderConfirmed([], [labeledBlock("interval", "멘트", 0)]);
    expect(screen.queryByText(/셋리스트 확정/)).not.toBeInTheDocument();
    expect(screen.queryByText(/다음 공연 준비 완료/)).not.toBeInTheDocument();
  });

  it("trusts the confirm flag while a failed server read leaves the setlist unknown, and prints no count it cannot know", () => {
    renderConfirmed(fiveCandidates, null);
    expect(screen.getByText(/셋리스트 확정/)).toBeInTheDocument();
    expect(bannerLine()).toBe("다음 공연 준비 완료");
    expect(sharedSetlistCard()).toEqual({
      title: "🎵 셋리스트 확정 — 10월 합주",
      description: "셋리스트가 확정됐어요",
      imageStage: null,
      imageCount: null,
    });
  });
});
