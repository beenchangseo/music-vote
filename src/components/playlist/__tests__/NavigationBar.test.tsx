// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NavigationBar from "../NavigationBar";

afterEach(cleanup);

describe("NavigationBar", () => {
  it("has 홈 · 후보곡 · 셋리스트 · 합주, with 홈 a link to the app home", () => {
    const onModeChange = vi.fn();
    render(<NavigationBar mode="playlist" onModeChange={onModeChange} />);
    const nav = screen.getByRole("navigation", { name: "플레이리스트 화면" });

    const tabs = [...nav.querySelectorAll("a, button")];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["홈", "후보곡", "셋리스트", "합주"]);
    expect(within(nav).getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("button", { name: "후보곡" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(nav).getByRole("button", { name: "셋리스트" }));
    expect(onModeChange).toHaveBeenCalledWith("setlist");
  });
});
