// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BandStartArea from "../BandStartArea";

afterEach(cleanup);

describe("BandStartArea (DR1)", () => {
  it("puts the first playlist first and calling members second", () => {
    const onInvite = vi.fn();
    render(<BandStartArea newRoomHref="/new?band=t-1" onInvite={onInvite} attachableCount={0} onAttach={vi.fn()} />);

    const primary = screen.getByRole("link", { name: "첫 플레이리스트 만들기" });
    const invite = screen.getByRole("button", { name: "카톡으로 멤버 부르기" });
    expect(primary).toHaveAttribute("href", "/new?band=t-1");
    expect(primary.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "있던 플레이리스트 넣기" })).not.toBeInTheDocument();

    fireEvent.click(invite);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it("makes putting in an existing playlist the main button when there is one, keeping a small new-playlist link (DR8)", () => {
    const onAttach = vi.fn();
    render(<BandStartArea newRoomHref="/new?band=t-1" onInvite={vi.fn()} attachableCount={3} onAttach={onAttach} />);
    fireEvent.click(screen.getByRole("button", { name: "있던 플레이리스트 넣기" }));
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "첫 플레이리스트 만들기" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 플레이리스트 만들기" })).toHaveAttribute("href", "/new?band=t-1");
  });
});
