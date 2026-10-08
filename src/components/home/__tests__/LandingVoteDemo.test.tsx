// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [() => {}] }));

import LandingVoteDemo, { DEMO_SONGS, rankDemoSongs } from "../LandingVoteDemo";

afterEach(cleanup);

const titles = () => screen.getAllByRole("listitem").map((row) => row.querySelector("p")!.textContent);

describe("rankDemoSongs", () => {
  it("orders by score and keeps list order for ties", () => {
    expect(rankDemoSongs(DEMO_SONGS, {}).map((row) => row.song.id)).toEqual([
      "tomboy",
      "page",
      "lovers",
      "twentyfive",
      "anger",
    ]);
  });

  it("adds my vote to the members' score", () => {
    const ranked = rankDemoSongs(DEMO_SONGS, { twentyfive: 1, page: -1 });
    expect(ranked.map((row) => [row.song.id, row.score])).toEqual([
      ["tomboy", 2],
      ["twentyfive", 2],
      ["page", 1],
      ["lovers", 1],
      ["anger", 0],
    ]);
  });
});

describe("LandingVoteDemo", () => {
  it("moves a song up when I vote for it, and back when I take the vote back", () => {
    render(<LandingVoteDemo />);
    expect(titles()[3]).toBe("스물다섯, 스물하나");
    expect(screen.getByText("4명 투표 · 내 차례")).toBeInTheDocument();

    const up = screen.getByRole("button", { name: "스물다섯, 스물하나 찬성" });
    fireEvent.click(up);
    expect(titles()[2]).toBe("스물다섯, 스물하나");
    expect(up).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("내 표 1개 · 5명 참여")).toBeInTheDocument();

    fireEvent.click(up);
    expect(titles()[3]).toBe("스물다섯, 스물하나");
    expect(up).toHaveAttribute("aria-pressed", "false");
  });

  it("switches my vote when I press the other direction", () => {
    render(<LandingVoteDemo />);
    fireEvent.click(screen.getByRole("button", { name: "TOMBOY 찬성" }));
    fireEvent.click(screen.getByRole("button", { name: "TOMBOY 반대" }));

    expect(screen.getByRole("button", { name: "TOMBOY 찬성" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "TOMBOY 반대" })).toHaveAttribute("aria-pressed", "true");
    expect(titles()[0]).toBe("한 페이지가 될 수 있게");
  });
});
