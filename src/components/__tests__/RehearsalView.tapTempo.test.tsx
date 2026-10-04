// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RehearsalView from "../RehearsalView";
import { TAP_RESET_MS } from "@/lib/tap-tempo";
import type { SetlistItem, SongWithScore } from "@/lib/types";

const updateSongMeta = vi.fn();
const track = vi.fn();
const showAlert = vi.fn();

vi.mock("@/actions/song", () => ({ updateSongMeta: (...args: unknown[]) => updateSongMeta(...args) }));
vi.mock("@/actions/comment", () => ({ addOrUpdateComment: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("../DialogProvider", () => ({
  useDialog: () => ({ showAlert, showConfirm: vi.fn(), showDanger: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

const song = (id: string, title: string, tempo_bpm: number | null) =>
  ({ id, title, artist: "밴드", tempo_bpm, key_root: null, key_mode: null, key_memo: null, duration_seconds: null, thumbnail_url: null }) as SongWithScore;
const item = (id: string, songId: string, position: number) =>
  ({ id, playlist_id: "playlist", position, item_type: "song", song_id: songId, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

let clock = 0;

function renderRehearsal(firstBpm: number | null = null) {
  render(
    <RehearsalView
      setlistItems={[item("i1", "s1", 0), item("i2", "s2", 1)]}
      songs={[song("s1", "첫 곡", firstBpm), song("s2", "둘째 곡", 90)]}
      comments={[]}
      playlistId="playlist"
      shareCode="share"
      nickname="베이스"
      loading={false}
      onCommentsChange={vi.fn()}
    />,
  );
}

/** Taps the button `count` times, `intervalMs` apart on the tap clock. */
function tap(count: number, intervalMs = 500) {
  const button = screen.getByRole("button", { name: "탭 템포" });
  for (let i = 0; i < count; i += 1) {
    clock += intervalMs;
    fireEvent.click(button);
  }
}

async function idle() {
  await act(async () => {
    vi.advanceTimersByTime(TAP_RESET_MS + 1);
  });
  await act(async () => {});
}

describe("RehearsalView tap tempo", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clock = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    updateSongMeta.mockReset().mockResolvedValue({ success: true });
    track.mockReset();
    showAlert.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fills the BPM on the 4th tap and saves once when tapping stops", async () => {
    renderRehearsal();
    tap(3);
    expect(screen.getByRole("button", { name: "BPM 적어두기" })).toBeInTheDocument();

    tap(1);
    expect(screen.getByRole("button", { name: "BPM 120 고치기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /메트로놈 · 120/ })).toBeInTheDocument();
    expect(updateSongMeta).not.toHaveBeenCalled();

    await idle();
    expect(updateSongMeta).toHaveBeenCalledTimes(1);
    expect(updateSongMeta).toHaveBeenCalledWith("s1", "playlist", "share", { tempoBpm: 120 });
    expect(track).toHaveBeenCalledWith("tap_tempo_used", { taps: 4 });
  });

  it("does nothing after fewer than 4 taps", async () => {
    renderRehearsal();
    tap(3);
    await idle();

    expect(updateSongMeta).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "BPM 적어두기" })).toBeInTheDocument();
  });

  it("saves a finished tempo to its own song when moving on mid-sequence", async () => {
    renderRehearsal();
    tap(4);
    fireEvent.click(screen.getByRole("button", { name: "다음 곡" }));
    await act(async () => {});

    expect(updateSongMeta).toHaveBeenCalledWith("s1", "playlist", "share", { tempoBpm: 120 });
    // The next song keeps its own BPM and starts a fresh sequence.
    expect(screen.getByRole("button", { name: "BPM 90 고치기" })).toBeInTheDocument();
  });

  it("goes back to the saved BPM and tells the user when saving fails", async () => {
    updateSongMeta.mockRejectedValue(new Error("로그인이 필요합니다."));
    renderRehearsal(100);
    tap(4);
    expect(screen.getByRole("button", { name: "BPM 120 고치기" })).toBeInTheDocument();

    await idle();
    expect(showAlert).toHaveBeenCalledWith("BPM 을 저장하지 못했어요. 다시 탭해 주세요.");
    expect(screen.getByRole("button", { name: "BPM 100 고치기" })).toBeInTheDocument();
  });
});
