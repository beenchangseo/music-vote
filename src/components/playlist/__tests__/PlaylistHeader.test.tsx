// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlaylistHeader from "../PlaylistHeader";
import type { CardImage } from "@/domain/share-card";

vi.mock("../AnnouncementButton", () => ({ default: () => null }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

const sendDefault = vi.fn();
const BAND = { id: "11111111-1111-4111-8111-111111111111", name: "일코해제", nextShowAt: "2026-10-16" };
// What the page built and signed for this playlist (src/app/playlist/[shareCode]/page.tsx).
const SHARE = { image: "/api/og?card=v1.payload.signature" as CardImage, description: "낭만고양이·벚꽃 엔딩 외 1곡 · 2명 참여 중" };

function renderHeader(props: Partial<Parameters<typeof PlaylistHeader>[0]> = {}) {
  render(
    <PlaylistHeader playlistId="p1" title="10월 합주" share={SHARE} shareCode="abc123" {...props} />,
  );
}

type SentCard = { content: { description: string; imageUrl: string; imageWidth: number; imageHeight: number } };

function sharedCard(): SentCard["content"] {
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  return (sendDefault.mock.calls[0][0] as SentCard).content;
}

function sharedDescription(): string {
  return sharedCard().description;
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

describe("PlaylistHeader vote invite card", () => {
  it("shares the card the page signed, under this site's origin", () => {
    renderHeader();
    const card = sharedCard();
    expect(card.imageUrl).toBe(`${window.location.origin}${SHARE.image}`);
    expect(card.description).toBe(SHARE.description);
    expect(card).toMatchObject({ imageWidth: 1200, imageHeight: 630 });
  });
});

describe("PlaylistHeader band room", () => {
  it("prefixes the room card with the upcoming show date, no D-day number", () => {
    renderHeader({ showDate: "2026-10-16" });
    const description = sharedDescription();
    expect(description).toBe("10월 16일 공연 · 낭만고양이·벚꽃 엔딩 외 1곡 · 2명 참여 중");
    expect(description).not.toMatch(/D-/);
  });

  it("does not put a past show date on the card", () => {
    renderHeader({ showDate: "2026-10-03" });
    expect(sharedDescription()).toBe("낭만고양이·벚꽃 엔딩 외 1곡 · 2명 참여 중");
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
