// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeftBandNotice, { LEFT_BAND_STORAGE_KEY } from "../LeftBandNotice";
import MyBands from "../MyBands";
import MyPlaylists from "../MyPlaylists";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

const TEAM = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  replace.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("LeftBandNotice (디자인 2회차 6A)", () => {
  it("says which band was left, once, and strips ?left=1", () => {
    window.sessionStorage.setItem(LEFT_BAND_STORAGE_KEY, "일코해제");
    render(<LeftBandNotice left />);
    expect(screen.getByRole("status")).toHaveTextContent("일코해제에서 나왔어요");
    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
    expect(window.sessionStorage.getItem(LEFT_BAND_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falls back to a plain line when the name is missing or storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<LeftBandNotice left />);
    expect(screen.getByRole("status")).toHaveTextContent("밴드에서 나왔어요");
  });

  it("stays silent without ?left=1", () => {
    window.sessionStorage.setItem(LEFT_BAND_STORAGE_KEY, "일코해제");
    render(<LeftBandNotice left={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("MyBands (4A)", () => {
  it("is hidden without bands", () => {
    const { container } = render(<MyBands teams={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one row per band with the D-day and the room count", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
    render(
      <MyBands
        teams={[
          { id: TEAM, name: "일코해제", nextShowAt: "2026-10-16", role: "owner", roomCount: 3 },
          { id: "22222222-2222-4222-8222-222222222222", name: "산울림", nextShowAt: "2026-10-01", role: "member", roomCount: 1 },
        ]}
      />,
    );
    const first = screen.getByRole("link", { name: /일코해제/ });
    expect(first).toHaveAttribute("href", `/band/${TEAM}`);
    expect(first).toHaveTextContent("공연 D-12");
    expect(first).toHaveTextContent("합주방 3");
    // A past show is not shown on the home line.
    expect(screen.getByRole("link", { name: /산울림/ })).not.toHaveTextContent("공연");
  });
});

describe("MyPlaylists band caption", () => {
  it("marks band rooms with the band name", () => {
    render(
      <MyPlaylists
        dbPlaylists={[
          { id: "r1", shareCode: "abc", title: "10월 합주", teamName: "일코해제" },
          { id: "r2", shareCode: "def", title: "번개 합주", teamName: null },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /10월 합주/ })).toHaveTextContent("일코해제");
    expect(screen.getByRole("link", { name: /번개 합주/ })).not.toHaveTextContent("일코해제");
  });
});
