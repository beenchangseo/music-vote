// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScreenToolbar from "../ScreenToolbar";
import ViewSwitcher from "../ViewSwitcher";

const VIEWS = [
  { value: "playlist", label: "후보곡" },
  { value: "setlist", label: "셋리스트" },
  { value: "rehearsal", label: "합주" },
] as const;

const published = (name: string) => document.documentElement.style.getPropertyValue(name);

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
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(68);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ViewSwitcher (#110)", () => {
  it("is a radio group that hands the picked view to the caller", () => {
    const onChange = vi.fn();
    render(<ViewSwitcher options={VIEWS} value="playlist" onChange={onChange} aria-label="플레이리스트 보기" />);
    expect(screen.getByRole("radio", { name: "후보곡" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "합주" }));
    expect(onChange).toHaveBeenCalledWith("rehearsal");
  });

  // jsdom has no layout, so this reads what CSS would: the switcher pins at the very top and the bar under it pins at
  // the height the switcher publishes, so the two stack instead of one covering the other.
  it("pins at the top and publishes its height, which the screen toolbar pins under", () => {
    const { unmount } = render(
      <>
        <ViewSwitcher options={VIEWS} value="rehearsal" onChange={() => {}} aria-label="플레이리스트 보기" />
        <ScreenToolbar stat="1 / 6" />
      </>,
    );
    expect(screen.getByRole("radiogroup", { name: "플레이리스트 보기" }).parentElement).toHaveClass("sticky", "top-0");
    expect(screen.getByText("1 / 6").parentElement).toHaveClass("sticky", "top-view-switcher");
    expect(published("--view-switcher-height")).toBe("68px");

    unmount();
    expect(published("--view-switcher-height")).toBe("");
  });
});
