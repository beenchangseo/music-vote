// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TabBar from "../TabBar";

afterEach(cleanup);

const TABS = [
  { id: "playlist", label: "후보곡", icon: null },
  { id: "setlist", label: "셋리스트", icon: null },
  { id: "rehearsal", label: "합주", icon: null },
] as const;

describe("TabBar", () => {
  it("is named navigation that marks the current screen", () => {
    render(<TabBar aria-label="플레이리스트 화면" items={TABS} value="setlist" onChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "플레이리스트 화면" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "셋리스트" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "후보곡" })).not.toHaveAttribute("aria-current");
  });

  it("hands the tapped tab to the caller", () => {
    const onChange = vi.fn();
    render(<TabBar aria-label="플레이리스트 화면" items={TABS} value="playlist" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "합주" }));
    expect(onChange).toHaveBeenCalledWith("rehearsal");
  });
});
