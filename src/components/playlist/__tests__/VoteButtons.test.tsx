// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VoteButtons from "../VoteButtons";
import { COLORS } from "@/components/ui/tokens";
import { chevronPointing } from "@/components/ui/__tests__/chevron-pointing";

// jsdom has no AnimationEvent, so react-dom would listen for webkitAnimationEnd instead of the animationend browsers fire.
// The stand-in keeps animationName, which jsdom's plain Event would drop.
vi.hoisted(() => {
  if (!("AnimationEvent" in window)) {
    class AnimationEvent extends Event {
      animationName: string;
      constructor(type: string, init: AnimationEventInit = {}) {
        super(type, init);
        this.animationName = init.animationName ?? "";
      }
    }
    Object.assign(window, { AnimationEvent });
  }
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

    fireEvent.animationEnd(up, { animationName: "vote-pop" });
    expect(up).not.toHaveClass("animate-vote-pop");

    fireEvent.click(up);
    expect(up).toHaveClass("animate-vote-pop");
  });

  it("keeps popping when an animation inside the arrow ends first", () => {
    renderButtons();
    const up = screen.getByRole("button", { name: "찬성표 추가" });

    fireEvent.click(up);
    fireEvent.animationEnd(up.querySelector("svg")!, { animationName: "score-in" });
    expect(up).toHaveClass("animate-vote-pop");

    fireEvent.animationEnd(up, { animationName: "vote-pop" });
    expect(up).not.toHaveClass("animate-vote-pop");
  });

  it("names the next action on a chosen arrow instead of announcing a toggle", () => {
    render(<VoteButtons score={3} userVote={1} userVoteCount={2} votingMode="allocated" onPress={() => undefined} />);

    const up = screen.getByRole("button", { name: "찬성표 추가" });
    expect(up).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "찬성표 한 개 취소" })).not.toHaveAttribute("aria-pressed");
  });

  it("leaves no timer behind when it unmounts right after a press", () => {
    vi.useFakeTimers();
    const { unmount } = renderButtons();

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("VoteButtons arrows", () => {
  it.each([
    ["찬성표 추가", "up"],
    ["반대표 추가", "down"],
  ] as const)("draws the %s button's chevron pointing %s", (name, direction) => {
    renderButtons();
    expect(chevronPointing(screen.getByRole("button", { name }).querySelector("svg")!)).toBe(direction);
  });
});

// A colour on the pill only counts when tokens.ts holds it to 4.5:1 on what it sits on, so tokens.test guards the contrast.
const colorsOf = (el: Element, prefix: "bg" | "text") =>
  el.className
    .split(/\s+/)
    .filter((c) => c.startsWith(`${prefix}-`) && COLORS.has(c.slice(prefix.length + 1)))
    .map((c) => c.slice(prefix.length + 1));
const heldTo45 = (fg: string | undefined, bg: string | undefined) =>
  [COLORS.get(fg ?? "")?.pairs.find((p) => p.against === bg), COLORS.get(bg ?? "")?.pairs.find((p) => p.against === fg)].some((p) => p?.min === 4.5);

describe("VoteButtons colours", () => {
  it.each([
    ["an up vote", 3, 1],
    ["a down vote", -2, -1],
    ["no vote", 0, null],
  ] as const)("with %s, each arrow and the score reach 4.5:1 on the pill or their disc", (_label, score, userVote) => {
    const { container } = render(
      <VoteButtons score={score} userVote={userVote} userVoteCount={userVote ? 1 : 0} votingMode="free" onPress={() => undefined} />,
    );
    const [pill] = colorsOf(container.firstElementChild!, "bg");
    for (const arrow of screen.getAllByRole("button")) {
      const [glyph] = colorsOf(arrow, "text");
      const [disc = pill] = colorsOf(arrow, "bg");
      expect(heldTo45(glyph, disc), `${arrow.getAttribute("aria-label")}: ${glyph} on ${disc}`).toBe(true);
    }
    const [scoreColor] = colorsOf(screen.getByRole("status"), "text");
    expect(heldTo45(scoreColor, pill), `score: ${scoreColor} on ${pill}`).toBe(true);
  });
});
