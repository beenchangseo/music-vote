// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TabBar, { type TabBarItem } from "../TabBar";

afterEach(cleanup);

const Glyph = ({ filled = false }: { filled?: boolean }) => <svg data-filled={filled} aria-hidden />;

const TABS: TabBarItem<"playlist" | "setlist" | "rehearsal">[] = [
  { href: "/", label: "홈", icon: Glyph },
  { id: "playlist", label: "후보곡", icon: Glyph },
  { id: "setlist", label: "셋리스트", icon: Glyph },
  { id: "rehearsal", label: "합주", icon: Glyph },
];

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

  it("takes a link tab that leaves the screen instead of switching it", () => {
    const onChange = vi.fn();
    render(<TabBar aria-label="플레이리스트 화면" items={TABS} value="playlist" onChange={onChange} />);
    const home = screen.getByRole("link", { name: "홈" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("button", { name: "홈" })).not.toBeInTheDocument();
  });

  // The bar is fixed to the bottom edge, so on iPhone its tabs sit under the home indicator unless it pads that area
  // itself. data-safe-bottom tells the body to drop its own inset padding, so the two never stack.
  it("pads the home indicator area under its tabs and takes it over from the body", () => {
    render(<TabBar aria-label="플레이리스트 화면" items={TABS} value="playlist" onChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "플레이리스트 화면" });
    expect(nav).toHaveAttribute("data-safe-bottom");
    expect(nav).toHaveClass("pb-safe-bottom");
  });

  it("fills the icon of the current tab only", () => {
    render(<TabBar aria-label="플레이리스트 화면" items={TABS} value="setlist" onChange={() => {}} />);
    const filled = (name: string) => screen.getByRole(name === "홈" ? "link" : "button", { name }).querySelector("svg")?.getAttribute("data-filled");
    expect(["홈", "후보곡", "셋리스트", "합주"].map(filled)).toEqual(["false", "false", "true", "false"]);
  });
});
