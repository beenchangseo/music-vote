// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RehearsalView from "../RehearsalView";
import type { Comment, SetlistItem, SongWithScore } from "@/domain/types";

const updateSongMeta = vi.fn();

vi.mock("@/actions/song", () => ({ updateSongMeta: (...args: unknown[]) => updateSongMeta(...args) }));
vi.mock("@/actions/comment", () => ({ addOrUpdateComment: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({
  useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

const song = { id: "s1", title: "첫 곡", artist: "밴드", tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, duration_seconds: null, thumbnail_url: null } as SongWithScore;
const item = { id: "i1", playlist_id: "playlist", position: 0, item_type: "song", song_id: "s1", label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" } as SetlistItem;
const comment: Comment = { id: "c1", song_id: "s1", nickname: "기타", content: "브릿지 빠르게", created_at: "", updated_at: "", isMine: false };

let clock = 0;

function renderRehearsal() {
  render(
    <RehearsalView
      setlistItems={[item]}
      songs={[song]}
      comments={[comment]}
      playlistId="playlist"
      shareCode="share"
      nickname="베이스"
      loading={false}
      onCommentsChange={vi.fn()}
    />,
  );
}

const card = () => screen.getByRole("region", { name: "지금 곡" });
const commentToggle = () => within(card()).getByRole("button", { name: /^코멘트 1/ });

/** A keyboard user's Enter on the focused toggle: the browser fires click on the focused button. */
function pressToggle() {
  const toggle = commentToggle();
  toggle.focus();
  fireEvent.click(toggle);
}

describe("RehearsalView comment toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clock = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    updateSongMeta.mockReset().mockResolvedValue({ success: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps keyboard focus on the toggle when comments open and close", () => {
    renderRehearsal();
    pressToggle();
    expect(screen.getByText("브릿지 빠르게")).toBeInTheDocument();
    expect(commentToggle()).toHaveFocus();

    fireEvent.click(commentToggle());
    expect(screen.queryByText("브릿지 빠르게")).not.toBeInTheDocument();
    expect(commentToggle()).toHaveFocus();
  });

  it("keeps a BPM being typed, so the next save does not send the old value", async () => {
    renderRehearsal();
    fireEvent.click(screen.getByRole("button", { name: "BPM 적어두기" }));
    const bpm = screen.getByPlaceholderText("BPM");
    fireEvent.change(bpm, { target: { value: "130" } });
    fireEvent.blur(bpm);
    await act(async () => {});
    expect(updateSongMeta).toHaveBeenLastCalledWith("s1", "playlist", "share", expect.objectContaining({ tempoBpm: 130 }));

    pressToggle();
    expect(screen.getByPlaceholderText("BPM")).toHaveValue(130);

    fireEvent.blur(screen.getByPlaceholderText("BPM"));
    await act(async () => {});
    expect(updateSongMeta).toHaveBeenLastCalledWith("s1", "playlist", "share", expect.objectContaining({ tempoBpm: 130 }));
  });

  it("keeps tap tempo progress, so taps on both sides of the toggle fill the BPM", () => {
    renderRehearsal();
    const tap = () => {
      clock += 500;
      fireEvent.click(screen.getByRole("button", { name: "탭 템포" }));
    };
    tap();
    tap();
    pressToggle();
    tap();
    tap();
    expect(screen.getByRole("button", { name: "BPM 120 고치기" })).toBeInTheDocument();
  });
});
