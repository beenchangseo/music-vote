// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("dims a link tab with nowhere to go yet, and keeps it in its place", () => {
    const items: TabBarItem<"band">[] = [
      { id: "band", label: "밴드 홈", icon: Glyph },
      { href: null, label: "후보곡", icon: Glyph },
      { href: "/playlist/abc123?tab=setlist", label: "셋리스트", icon: Glyph },
    ];
    render(<TabBar aria-label="밴드 화면" items={items} value="band" onChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "밴드 화면" });

    expect([...nav.querySelectorAll("a, button, [role=link]")].map((tab) => tab.textContent)).toEqual(["밴드 홈", "후보곡", "셋리스트"]);
    const dimmed = screen.getByRole("link", { name: "후보곡" });
    expect(dimmed).toHaveAttribute("aria-disabled", "true");
    expect(dimmed).not.toHaveAttribute("href");
    expect(screen.getByRole("link", { name: "셋리스트" })).not.toHaveAttribute("aria-disabled");
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

// jsdom has no layout, so this reads what CSS would. The MiniPlayer sits on the height the bar publishes and the body
// leaves that much room at the end of the page (layout.tsx), so a bar that stops publishing hides both under itself.
describe("TabBar published height", () => {
  const publishedHeight = () => document.documentElement.style.getPropertyValue("--tab-bar-height");

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly measure: () => void) {}
        observe() {
          this.measure();
        }
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(98);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("publishes its height, home indicator included, while it is on screen", () => {
    const { unmount } = render(<TabBar aria-label="플레이리스트 화면" items={TABS} value="playlist" onChange={() => {}} />);
    expect(publishedHeight()).toBe("98px");

    unmount();
    expect(publishedHeight()).toBe("");
  });
});
