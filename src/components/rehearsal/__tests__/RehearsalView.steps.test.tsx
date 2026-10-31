// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RehearsalView from "../RehearsalView";
import { fixtureItems, fixtureSongs } from "@/domain/__tests__/setlist-fixture";
import type { Comment, SetlistItem } from "@/domain/types";

vi.mock("@/actions/song", () => ({ updateSongMeta: vi.fn() }));
vi.mock("@/actions/comment", () => ({ addOrUpdateComment: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({
  useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

function renderRehearsal({ items = fixtureItems, comments = [] }: { items?: SetlistItem[]; comments?: Comment[] } = {}) {
  return render(
    <RehearsalView
      setlistItems={items}
      songs={fixtureSongs}
      comments={comments}
      playlistId="playlist"
      shareCode="share"
      nickname="베이스"
      loading={false}
      onCommentsChange={vi.fn()}
    />,
  );
}

const currentCard = () => screen.getByRole("region", { name: "지금 곡" });
const next = () => fireEvent.click(screen.getByRole("button", { name: "다음으로" }));
const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("RehearsalView steps", () => {
  afterEach(cleanup);

  it("counts songs and originals but not intervals, and expands only the current step", () => {
    renderRehearsal();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(within(currentCard()).getByRole("heading", { name: "첫 곡" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "탭 템포" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /시간 모르는 곡/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /우리 노래/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /끝 곡/ })).toBeInTheDocument();
  });

  it("shows the interval after the current step as the 다음 hint right under its card", () => {
    renderRehearsal();
    const hint = screen.getByText("다음: 기타 셋업 변경");
    expect(currentCard()).not.toContainElement(hint);
    expect(follows(currentCard(), hint)).toBe(true);
    expect(follows(hint, screen.getByRole("button", { name: /시간 모르는 곡/ }))).toBe(true);
  });

  it("moves to the next step, which has no hint when a song comes right after it", () => {
    renderRehearsal();
    next();
    expect(within(currentCard()).getByRole("heading", { name: "시간 모르는 곡" })).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.queryByText(/^다음:/)).not.toBeInTheDocument();
    expect(screen.getByText("기타 셋업 변경")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /첫 곡/ })).toBeInTheDocument();
  });

  it("shows an original as one step with its description and length, without song meta or comments", () => {
    renderRehearsal();
    next();
    next();
    const card = currentCard();
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "우리 노래" })).toBeInTheDocument();
    expect(card).toHaveTextContent("자작곡 · 첫 자작곡");
    expect(within(card).getByText("3:45")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /적어두기|고치기/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /코멘트/ })).not.toBeInTheDocument();
  });

  it("jumps to a step when its row is tapped", () => {
    renderRehearsal();
    fireEvent.click(screen.getByRole("button", { name: /끝 곡/ }));
    expect(within(currentCard()).getByRole("heading", { name: "끝 곡" })).toBeInTheDocument();
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "마지막 곡이에요" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /첫 곡/ }));
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("keeps an interval after the last step as its 다음 hint", () => {
    const encore = { ...fixtureItems[0], id: "item-7", position: 7, label: "앵콜 대기", description: null, duration_seconds: 60 };
    renderRehearsal({ items: [...fixtureItems, encore] });
    fireEvent.click(screen.getByRole("button", { name: /끝 곡/ }));
    expect(screen.getByText("다음: 앵콜 대기")).toBeInTheDocument();
    expect(screen.getByText("남은 5:23")).toBeInTheDocument();
  });

  it("stays on the same song when a song before it is removed", () => {
    const { rerender } = renderRehearsal();
    next();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();

    rerender(
      <RehearsalView
        setlistItems={fixtureItems.filter((item) => item.song_id !== "a")}
        songs={fixtureSongs}
        comments={[]}
        playlistId="playlist"
        shareCode="share"
        nickname="베이스"
        loading={false}
        onCommentsChange={vi.fn()}
      />,
    );
    expect(within(currentCard()).getByRole("heading", { name: "시간 모르는 곡" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("keeps keyboard focus on the moving card's controls and marks finished steps for screen readers", () => {
    renderRehearsal();
    next();
    expect(screen.getByRole("button", { name: "다음으로" })).toHaveFocus();
    expect(currentCard()).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /첫 곡/ })).toHaveAccessibleName(/끝남/);

    fireEvent.click(screen.getByRole("button", { name: /끝 곡/ }));
    expect(screen.getByRole("button", { name: "이전 곡" })).toHaveFocus();
  });

  it("opens the current song's comments from its card", () => {
    const comment = { id: "c1", song_id: "a", nickname: "기타", content: "브릿지 빠르게", created_at: "", updated_at: "" };
    renderRehearsal({ comments: [comment] });
    expect(screen.queryByText("브릿지 빠르게")).not.toBeInTheDocument();

    fireEvent.click(within(currentCard()).getByRole("button", { name: /코멘트 1/ }));
    expect(screen.getByText("브릿지 빠르게")).toBeInTheDocument();
  });
});
