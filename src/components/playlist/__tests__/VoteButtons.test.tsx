// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VoteButtons from "../VoteButtons";

// jsdom has no AnimationEvent, so react-dom would listen for webkitAnimationEnd instead of the animationend browsers fire.
vi.hoisted(() => {
  if (!("AnimationEvent" in window)) Object.assign(window, { AnimationEvent: Event });
});

vi.mock("@/lib/kakao-login", () => ({ triggerKakaoLogin: vi.fn() }));

function renderButtons() {
  return render(
    <VoteButtons score={0} userVote={null} userVoteCount={0} votingMode="free" onPress={() => undefined} />,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("VoteButtons pop", () => {
  it("pops the pressed arrow until its animation ends, and pops again on the next press", () => {
    renderButtons();
    const up = screen.getByRole("button", { name: "찬성표 추가" });
    const down = screen.getByRole("button", { name: "반대표 추가" });

    fireEvent.click(up);
    expect(up).toHaveClass("animate-vote-pop");
    expect(down).not.toHaveClass("animate-vote-pop");

    fireEvent.animationEnd(up);
    expect(up).not.toHaveClass("animate-vote-pop");

    fireEvent.click(up);
    expect(up).toHaveClass("animate-vote-pop");
  });

  it("leaves no timer behind when it unmounts right after a press", () => {
    vi.useFakeTimers();
    const { unmount } = renderButtons();

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
