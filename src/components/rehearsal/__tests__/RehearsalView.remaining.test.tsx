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

function rehearsal(setlistItems = fixtureItems) {
  return (
    <RehearsalView
      setlistItems={setlistItems}
      songs={fixtureSongs}
      comments={[]}
      playlistId="playlist"
      shareCode="share"
      nickname="베이스"
      loading={false}
      onCommentsChange={vi.fn()}
    />
  );
}

function renderRehearsal() {
  return render(rehearsal());
}

describe("RehearsalView remaining time", () => {
  afterEach(cleanup);

  it("starts from the setlist tab's total less the opening sound check, which is over once the first song is on", () => {
    renderRehearsal();
    expect(screen.getByText(`남은 ${formatRuntime(FIXTURE_TOTAL_SECONDS - 120)}`)).toBeInTheDocument();
  });

  it("counts the interval in the 다음 hint as over once 다음으로 is pressed", () => {
    renderRehearsal();
    expect(screen.getByText("다음: 기타 셋업 변경")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음으로" }));
    // 16:28 minus the sound check (2:00), the first song (3:20) and the setup change (3:00).
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText("남은 8:08")).toBeInTheDocument();

    // The song before has no length, so the original starts at the same point.
    fireEvent.click(screen.getByRole("button", { name: "다음으로" }));
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("남은 8:08")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음으로" }));
    expect(screen.getByText("남은 4:23")).toBeInTheDocument();
  });

  it("stays on the new last step when the step it was on is removed from the setlist", () => {
    const { rerender } = renderRehearsal();
    fireEvent.click(screen.getByRole("button", { name: /끝 곡/ }));
    expect(screen.getByText("4 / 4")).toBeInTheDocument();

    rerender(rehearsal(fixtureItems.filter((item) => item.song_id !== "c")));
    expect(screen.getByRole("heading", { name: "우리 노래" })).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("마지막 곡이에요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이전 곡" }));
    expect(screen.getByRole("heading", { name: "시간 모르는 곡" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
