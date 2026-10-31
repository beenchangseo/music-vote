// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import SetlistView from "../SetlistView";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ addSongToSetlist: vi.fn(), removeSetlistItem: vi.fn(), updateSetlistOrder: vi.fn() }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("../SetlistShareButton", () => ({ default: () => null }));

const song = (id: string, title: string) =>
  ({ id, title, artist: "아티스트", thumbnail_url: null, duration_seconds: 200, tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, score: 0 }) as unknown as SongWithScore;
const songs = [song("a", "후보 1위"), song("b", "후보 2위")];

const at = (position: number, fields: Partial<SetlistItem>) =>
  ({ id: `item-${position}`, playlist_id: "p", position, item_type: "song", song_id: null, label: null, description: null, duration_seconds: 60, title_override: null, duration_override_seconds: null, created_at: "", ...fields }) as SetlistItem;

function renderSetlist(setlistItems: SetlistItem[], onPlay = vi.fn()) {
  render(
    <SetlistView
      setlistItems={setlistItems}
      songs={songs}
      playlistId="p"
      shareCode="abc123"
      adminToken={null}
      loading={false}
      onItemsChange={vi.fn()}
      title="10월 합주"
      access="read_only"
      onPlay={onPlay}
    />,
  );
  return onPlay;
}

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

describe("SetlistView playback", () => {
  it("plays the whole setlist from its first song, past a leading interval", () => {
    const onPlay = renderSetlist([
      at(0, { item_type: "interval", label: "멘트" }),
      at(1, { song_id: "b" }),
      at(2, { item_type: "original", label: "자작곡" }),
      at(3, { song_id: "a" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "셋리 전체 듣기" }));

    expect(onPlay).toHaveBeenCalledWith("b");
    expect(track).toHaveBeenCalledWith("play_all_started", { source: "setlist", song_count: 2 });
  });

  it("offers no 셋리 전체 듣기 when the setlist has no songs to play", () => {
    renderSetlist([at(0, { item_type: "interval", label: "멘트" }), at(1, { item_type: "original", label: "자작곡" })]);

    expect(screen.queryByRole("button", { name: "셋리 전체 듣기" })).not.toBeInTheDocument();
  });

  it("plays from a song when its thumbnail is tapped", () => {
    const onPlay = renderSetlist([at(0, { song_id: "b" }), at(1, { song_id: "a" })]);

    fireEvent.click(screen.getByRole("button", { name: "후보 1위 재생" }));

    expect(onPlay).toHaveBeenCalledWith("a");
  });
});
