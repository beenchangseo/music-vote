// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlaylistTopBar from "../PlaylistTopBar";

vi.mock("next/navigation", () => ({ usePathname: () => "/playlist/abc123" }));
vi.mock("../../auth/AuthMenu", () => ({ default: ({ nickname }: { nickname: string }) => <button type="button">{nickname} 계정 메뉴</button> }));
vi.mock("../../auth/LoginButton", () => ({ default: ({ label }: { label?: string }) => <button type="button">{label}</button> }));

const BAND = { id: "11111111-1111-4111-8111-111111111111", name: "일코해제", nextShowAt: "2026-10-16" };

beforeEach(() => {
  // 2026-10-04 12:00 KST
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PlaylistTopBar", () => {
  // The 밴드 홈 tab goes to the band (#106); a second way there in the top row would be a duplicate button.
  it("names a band member's band and the show D-day as text, not a link", () => {
    render(<PlaylistTopBar band={BAND} loginGate={false} currentUserNickname="보컬" />);
    const top = screen.getByRole("banner");
    expect(top).toHaveTextContent("일코해제·공연 D-12");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보컬 계정 메뉴" })).toBeInTheDocument();
  });

  it("hides the D-day once the show is over", () => {
    render(<PlaylistTopBar band={{ ...BAND, nextShowAt: "2026-10-03" }} loginGate={false} />);
    expect(screen.getByRole("banner")).toHaveTextContent("일코해제");
    expect(screen.getByRole("banner")).not.toHaveTextContent("공연");
  });

  it("gives everyone else no back chevron: the 홈 tab goes home", () => {
    render(<PlaylistTopBar band={null} loginGate={false} currentUserNickname="보컬" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보컬 계정 메뉴" })).toBeInTheDocument();
  });

  it("puts the login button on the right for a logged-out viewer", () => {
    render(<PlaylistTopBar band={null} loginGate />);
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /계정 메뉴/ })).not.toBeInTheDocument();
  });
});
