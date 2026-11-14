// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BandStartArea from "../BandStartArea";

afterEach(cleanup);

describe("BandStartArea (DR1, #110)", () => {
  it("points to the tab bar's ＋ 만들기 instead of a second create button, leaving calling members as its one button", () => {
    const onInvite = vi.fn();
    render(<BandStartArea onInvite={onInvite} />);

    expect(screen.getByRole("region", { name: "첫 플레이리스트부터 시작해요" })).toHaveTextContent("아래 ＋ 만들기로 첫 플레이리스트를 만들어요");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["카톡으로 멤버 부르기"]);

    fireEvent.click(buttons[0]);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });
});
