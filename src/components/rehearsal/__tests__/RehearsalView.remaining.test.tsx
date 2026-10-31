// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RehearsalView from "../RehearsalView";
import { formatRuntime } from "@/domain/setlist";
import { FIXTURE_TOTAL_SECONDS, fixtureItems, fixtureSongs } from "@/domain/__tests__/setlist-fixture";

vi.mock("@/actions/song", () => ({ updateSongMeta: vi.fn() }));
vi.mock("@/actions/comment", () => ({ addOrUpdateComment: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({
  useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

function renderRehearsal() {
  render(
    <RehearsalView
      setlistItems={fixtureItems}
      songs={fixtureSongs}
      comments={[]}
      playlistId="playlist"
      shareCode="share"
      nickname="베이스"
      loading={false}
      onCommentsChange={vi.fn()}
    />,
  );
}

describe("RehearsalView remaining time", () => {
  afterEach(cleanup);

  it("starts from the same total as the setlist tab, intervals and originals included", () => {
    renderRehearsal();
    expect(screen.getByText(`남은 ${formatRuntime(FIXTURE_TOTAL_SECONDS)}`)).toBeInTheDocument();
  });

  it("keeps the interval and original between two songs in the next song's remaining time", () => {
    renderRehearsal();
    fireEvent.click(screen.getByRole("button", { name: "다음 곡" }));
    // 14:28 minus the first song (3:20). The 3:00 setup change is still ahead.
    expect(screen.getByText("남은 11:08")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음 곡" }));
    // The original (3:45) and the last song (4:23) are left.
    expect(screen.getByText("남은 8:08")).toBeInTheDocument();
  });
});
