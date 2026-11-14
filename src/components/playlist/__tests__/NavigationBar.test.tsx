// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NavigationBar from "../NavigationBar";

afterEach(cleanup);

const TEAM = "11111111-1111-4111-8111-111111111111";
const tabsOf = (nav: HTMLElement) => [...nav.querySelectorAll("a, button")].map((tab) => tab.textContent);

describe("NavigationBar", () => {
  it("has 밴드 홈 · 후보곡 · 셋리스트 · 합주 for a band the viewer may see, with 밴드 홈 a link to that band", () => {
    const onModeChange = vi.fn();
    render(<NavigationBar band={{ id: TEAM }} mode="playlist" onModeChange={onModeChange} />);
    const nav = screen.getByRole("navigation", { name: "플레이리스트 화면" });

    expect(tabsOf(nav)).toEqual(["밴드 홈", "후보곡", "셋리스트", "합주"]);
    expect(within(nav).getByRole("link", { name: "밴드 홈" })).toHaveAttribute("href", `/band/${TEAM}`);
    expect(within(nav).getByRole("button", { name: "후보곡" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(nav).getByRole("button", { name: "셋리스트" }));
    expect(onModeChange).toHaveBeenCalledWith("setlist");
  });

  it("has 홈 to the app home in that place when there is no band to show", () => {
    render(<NavigationBar band={null} mode="playlist" onModeChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "플레이리스트 화면" });

    expect(tabsOf(nav)).toEqual(["홈", "후보곡", "셋리스트", "합주"]);
    expect(within(nav).getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
  });
});
