// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BandStartArea from "../BandStartArea";

afterEach(cleanup);

describe("BandStartArea (DR1)", () => {
  it("puts the first playlist first and calling members second", () => {
    const onInvite = vi.fn();
    render(<BandStartArea newRoomHref="/new?band=t-1" onInvite={onInvite} />);

    const primary = screen.getByRole("link", { name: "첫 플레이리스트 만들기" });
    const invite = screen.getByRole("button", { name: "카톡으로 멤버 부르기" });
    expect(primary).toHaveAttribute("href", "/new?band=t-1");
    expect(primary.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(invite);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });
});
