// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DialogProvider from "@/components/ui/DialogProvider";
import AddSongForm from "../AddSongForm";

const actions = vi.hoisted(() => ({ addSong: vi.fn(), searchSongs: vi.fn(), track: vi.fn() }));
vi.mock("@/actions/song", () => ({ addSong: actions.addSong }));
vi.mock("@/actions/youtube-search", () => ({ searchSongs: actions.searchSongs }));
vi.mock("@/lib/analytics", () => ({ track: actions.track }));

const LINK = "https://youtu.be/dQw4w9WgXcQ";

function submitLink(onAdded: () => void) {
  render(
    <DialogProvider>
      <AddSongForm playlistId="p1" shareCode="share" onAdded={onAdded} />
    </DialogProvider>,
  );
  const input = screen.getByRole("textbox", { name: "곡 이름으로 찾거나 YouTube 링크를 붙여넣으세요" });
  fireEvent.change(input, { target: { value: LINK } });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
  return input;
}

describe("AddSongForm when the server refuses the song", () => {
  beforeEach(() => {
    actions.addSong.mockReset();
    actions.track.mockReset();
  });
  afterEach(cleanup);

  // The page was opened before the deadline, so the form is still on screen when the server says no.
  it("tells the member the deadline passed and keeps what they typed", async () => {
    actions.addSong.mockResolvedValue({ success: false, reason: "deadline_passed" });
    const onAdded = vi.fn();

    const input = submitLink(onAdded);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("마감이 지나서 후보곡을 더 추가할 수 없어요.")).toBeInTheDocument();
    expect(actions.addSong).toHaveBeenCalledWith("p1", LINK, "share", undefined);
    expect(onAdded).not.toHaveBeenCalled();
    expect(actions.track).not.toHaveBeenCalled();
    expect(input).toHaveValue(LINK);
  });

  it("still announces and clears a song the server took", async () => {
    actions.addSong.mockResolvedValue({ success: true, needsManualTitle: false, notEmbeddable: false, prefilledMeta: false });
    const onAdded = vi.fn();

    const input = submitLink(onAdded);

    await vi.waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
