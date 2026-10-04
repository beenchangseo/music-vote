// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlaylistHeader from "../PlaylistHeader";

vi.mock("../AnnouncementButton", () => ({ default: () => null }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

const sendDefault = vi.fn();
const BAND = { id: "11111111-1111-4111-8111-111111111111", name: "일코해제", nextShowAt: "2026-10-16" };

function renderHeader(props: Partial<Parameters<typeof PlaylistHeader>[0]> = {}) {
  render(
    <PlaylistHeader playlistId="p1" title="10월 합주" songCount={3} shareCode="abc123" participantCount={2} {...props} />,
  );
}

function sharedDescription(): string {
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  return (sendDefault.mock.calls[0][0] as { content: { description: string } }).content.description;
}

beforeEach(() => {
  // 2026-10-04 12:00 KST
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
  sendDefault.mockReset();
  window.Kakao = { isInitialized: () => true, Share: { sendDefault } };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.Kakao;
});

describe("PlaylistHeader band room", () => {
  it("prefixes the room card with the upcoming show date, no D-day number", () => {
    renderHeader({ showDate: "2026-10-16" });
    const description = sharedDescription();
    expect(description).toBe("10월 16일 공연 · 3곡 등록 · 2명 참여 중");
    expect(description).not.toMatch(/D-/);
  });

  it("does not put a past show date on the card", () => {
    renderHeader({ showDate: "2026-10-03" });
    expect(sharedDescription()).toBe("3곡 등록 · 2명 참여 중");
  });

  it("shows the band path line with the D-day to members only", () => {
    renderHeader({ band: BAND, showDate: BAND.nextShowAt });
    const link = screen.getByRole("link", { name: /일코해제/ });
    expect(link).toHaveAttribute("href", `/band/${BAND.id}`);
    expect(link).toHaveTextContent("공연 D-12");
  });

  it("renders no band link without band info (non-members)", () => {
    renderHeader({ band: null, showDate: BAND.nextShowAt });
    expect(screen.queryByRole("link", { name: /일코해제/ })).not.toBeInTheDocument();
  });

  it("hides the D-day once the show is over", () => {
    renderHeader({ band: { ...BAND, nextShowAt: "2026-10-03" } });
    expect(screen.getByRole("link", { name: /일코해제/ })).not.toHaveTextContent("공연");
  });
});
