// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RehearsalView from "../RehearsalView";
import { TAP_RESET_MS } from "@/domain/tap-tempo";
import type { SetlistItem, SongWithScore } from "@/domain/types";

const updateSongMeta = vi.fn();
const track = vi.fn();
const showAlert = vi.fn();

vi.mock("@/actions/song", () => ({ updateSongMeta: (...args: unknown[]) => updateSongMeta(...args) }));
vi.mock("@/actions/comment", () => ({ addOrUpdateComment: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("../../ui/DialogProvider", () => ({
  useDialog: () => ({ showAlert, showConfirm: vi.fn(), showDanger: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

const song = (id: string, title: string, tempo_bpm: number | null) =>
  ({ id, title, artist: "밴드", tempo_bpm, key_root: null, key_mode: null, key_memo: null, duration_seconds: null, thumbnail_url: null }) as SongWithScore;
const item = (id: string, songId: string, position: number) =>
  ({ id, playlist_id: "playlist", position, item_type: "song", song_id: songId, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;
const original = { ...item("i3", "s1", 1), item_type: "original", song_id: null, label: "우리 노래", duration_seconds: 200 } as SetlistItem;

let clock = 0;
let audioTime = 0;
let clicks = 0;

function stubAudioContext() {
  audioTime = 0;
  clicks = 0;
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      get currentTime() {
        return audioTime;
      }
      destination = {};
      resume() {}
      close() {}
      createOscillator() {
        return {
          connect() {},
          frequency: {},
          start() {
            clicks += 1;
          },
          stop() {},
        };
      }
      createGain() {
        return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
      }
    },
  );
}

function listen(ms: number) {
  act(() => {
    audioTime += ms / 1000;
    vi.advanceTimersByTime(ms);
  });
}

function view(setlistItems: SetlistItem[], songs: SongWithScore[]) {
  return (
    <RehearsalView
      setlistItems={setlistItems}
      songs={songs}
      comments={[]}
      playlistId="playlist"
      shareCode="share"
      nickname="베이스"
      loading={false}
      onCommentsChange={vi.fn()}
    />
  );
}

function renderRehearsal(firstBpm: number | null = null) {
  render(view([item("i1", "s1", 0), item("i2", "s2", 1)], [song("s1", "첫 곡", firstBpm), song("s2", "둘째 곡", 90)]));
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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
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
    vi.unstubAllGlobals();
  });

  it("fills the BPM on the 4th tap and saves once when tapping stops", async () => {
    renderRehearsal();
    tap(3);
    expect(screen.getByRole("button", { name: "BPM 적어두기" })).toBeInTheDocument();

    tap(1);
    expect(screen.getByRole("button", { name: "BPM 120 고치기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "메트로놈 120 BPM" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "다음으로" }));
    await act(async () => {});

    expect(updateSongMeta).toHaveBeenCalledWith("s1", "playlist", "share", { tempoBpm: 120 });
    // The next song keeps its own BPM and starts a fresh sequence.
    expect(screen.getByRole("button", { name: "BPM 90 고치기" })).toBeInTheDocument();
  });

  it("keeps the metronome's name and text when it is turned on and off, and says which with aria-pressed", () => {
    stubAudioContext();
    renderRehearsal(107);
    const metronome = () => screen.getByRole("button", { name: "메트로놈 107 BPM" });
    const text = metronome().textContent;
    expect(metronome()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(metronome());
    expect(metronome()).toHaveAttribute("aria-pressed", "true");
    expect(metronome().textContent).toBe(text);

    fireEvent.click(metronome());
    expect(metronome()).toHaveAttribute("aria-pressed", "false");
    expect(metronome().textContent).toBe(text);
  });

  it("keeps the metronome in its place without a BPM, and opens the BPM field from it", () => {
    renderRehearsal();
    const metronome = screen.getByRole("button", { name: "메트로놈, BPM 적고 켜기" });
    expect(metronome).toHaveTextContent(/^메트로놈$/);
    expect(metronome).not.toHaveAttribute("aria-pressed");

    fireEvent.click(metronome);
    expect(screen.getByPlaceholderText("BPM")).toBeInTheDocument();
  });

  describe("when the BPM goes away while it plays", () => {
    function playAt107(setlistItems: SetlistItem[], songs: SongWithScore[]) {
      stubAudioContext();
      const { rerender } = render(view(setlistItems, songs));
      fireEvent.click(screen.getByRole("button", { name: "메트로놈 107 BPM" }));
      listen(1000);
      expect(clicks).toBeGreaterThan(0);
      return rerender;
    }

    it.each([null, 0])("stops when the song's BPM becomes %s, and stays off when it comes back", (cleared) => {
      const items = [item("i1", "s1", 0), item("i2", "s2", 1)];
      const rerender = playAt107(items, [song("s1", "첫 곡", 107), song("s2", "둘째 곡", 90)]);

      rerender(view(items, [song("s1", "첫 곡", cleared), song("s2", "둘째 곡", 90)]));
      expect(screen.getByRole("button", { name: "메트로놈, BPM 적고 켜기" })).not.toHaveAttribute("aria-pressed");
      const heard = clicks;
      listen(2000);
      expect(clicks).toBe(heard);

      rerender(view(items, [song("s1", "첫 곡", 107), song("s2", "둘째 곡", 90)]));
      expect(screen.getByRole("button", { name: "메트로놈 107 BPM" })).toHaveAttribute("aria-pressed", "false");
      listen(2000);
      expect(clicks).toBe(heard);
    });

    it.each([
      { next: "a song without a BPM", step: item("i2", "s2", 1), metronome: "메트로놈, BPM 적고 켜기" },
      { next: "an original", step: original, metronome: "메트로놈, 탭 템포로 BPM 맞추기" },
    ])("stops when another member removes the playing song and $next becomes the current step", ({ step, metronome }) => {
      const songs = [song("s1", "첫 곡", 107), song("s2", "둘째 곡", null)];
      const rerender = playAt107([item("i1", "s1", 0), step], songs);

      rerender(view([step], songs));
      expect(screen.getByRole("button", { name: metronome })).not.toHaveAttribute("aria-pressed");
      const heard = clicks;
      listen(2000);
      expect(clicks).toBe(heard);
    });
  });

  describe("on an original", () => {
    const renderWithOriginal = () =>
      render(view([item("i1", "s1", 0), original, item("i2", "s2", 2)], [song("s1", "첫 곡", 100), song("s2", "둘째 곡", 90)]));
    const go = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

    it("runs the metronome at the tapped BPM without saving it, since originals have no song row", async () => {
      renderWithOriginal();
      go("다음으로");
      expect(screen.getByRole("button", { name: "메트로놈, 탭 템포로 BPM 맞추기" })).toBeDisabled();

      tap(4);
      await idle();
      expect(screen.getByRole("button", { name: "메트로놈 120 BPM" })).toBeEnabled();
      expect(track).toHaveBeenCalledWith("tap_tempo_used", { taps: 4 });
      expect(updateSongMeta).not.toHaveBeenCalled();
    });

    it("keeps its tapped BPM after a song is tapped", async () => {
      renderWithOriginal();
      go("다음으로");
      tap(4);
      await idle();
      go("다음으로");
      tap(4, 600);
      await idle();
      go("이전 곡");
      expect(screen.getByRole("button", { name: "메트로놈 120 BPM" })).toBeInTheDocument();
    });

    it("stops a running metronome when moving to it without a BPM", () => {
      stubAudioContext();
      renderWithOriginal();
      go("메트로놈 100 BPM");
      expect(screen.getByRole("button", { name: "메트로놈 100 BPM" })).toHaveAttribute("aria-pressed", "true");

      go("다음으로");
      expect(screen.getByRole("button", { name: "메트로놈, 탭 템포로 BPM 맞추기" })).toBeDisabled();

      go("이전 곡");
      expect(screen.getByRole("button", { name: "메트로놈 100 BPM" })).toHaveAttribute("aria-pressed", "false");
    });
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
