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
  it("takes a band member back to the band, with the show D-day", () => {
    render(<PlaylistTopBar band={BAND} loginGate={false} currentUserNickname="보컬" />);
    const link = screen.getByRole("link", { name: /일코해제/ });
    expect(link).toHaveAttribute("href", `/band/${BAND.id}`);
    expect(link).toHaveTextContent("공연 D-12");
    expect(screen.queryByRole("link", { name: "홈으로" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보컬 계정 메뉴" })).toBeInTheDocument();
  });

  it("hides the D-day once the show is over", () => {
    render(<PlaylistTopBar band={{ ...BAND, nextShowAt: "2026-10-03" }} loginGate={false} />);
    expect(screen.getByRole("link", { name: /일코해제/ })).not.toHaveTextContent("공연");
  });

  it("gives everyone else a bare back chevron to the app home", () => {
    render(<PlaylistTopBar band={null} loginGate={false} currentUserNickname="보컬" />);
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /일코해제/ })).not.toBeInTheDocument();
  });

  it("puts the login button on the right for a logged-out viewer", () => {
    render(<PlaylistTopBar band={null} loginGate />);
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /계정 메뉴/ })).not.toBeInTheDocument();
  });
});
