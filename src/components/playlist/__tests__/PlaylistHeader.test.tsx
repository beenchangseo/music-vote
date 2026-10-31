// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlaylistHeader from "../PlaylistHeader";
import type { InviteSongs } from "@/domain/invite-card";

vi.mock("../AnnouncementButton", () => ({ default: () => null }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

const sendDefault = vi.fn();
const BAND = { id: "11111111-1111-4111-8111-111111111111", name: "일코해제", nextShowAt: "2026-10-16" };
const THREE_SONGS: InviteSongs = { cover: ["oSlqhkPa3no"], names: ["낭만고양이", "벚꽃 엔딩"], count: 3 };

function renderHeader(props: Partial<Parameters<typeof PlaylistHeader>[0]> = {}) {
  render(
    <PlaylistHeader playlistId="p1" title="10월 합주" inviteSongs={THREE_SONGS} shareCode="abc123" participantCount={2} {...props} />,
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
  it("shares the invite card with the song pictures and names", () => {
    renderHeader();
    const card = sharedCard();
    const image = new URL(card.imageUrl);
    expect(image.pathname).toBe("/api/og");
    expect(image.searchParams.get("variant")).toBe("playlist");
    expect(image.searchParams.get("title")).toBe("10월 합주");
    expect(image.searchParams.get("songs")).toBe("3");
    expect(image.searchParams.get("participants")).toBe("2");
    expect(image.searchParams.get("cover")).toBe("oSlqhkPa3no");
    expect(image.searchParams.getAll("name")).toEqual(["낭만고양이", "벚꽃 엔딩"]);
    expect(card).toMatchObject({ imageWidth: 1200, imageHeight: 630 });
  });

  it("shares the old card for an archived playlist, which takes no votes", () => {
    renderHeader({ archived: true });
    const card = sharedCard();
    expect(card.description).toBe("3곡 등록 · 2명 참여 중");
    const image = new URL(card.imageUrl);
    expect(image.pathname).toBe("/api/og");
    expect(image.search).toBe(`?title=${encodeURIComponent("10월 합주")}&songs=3&participants=2`);
  });

  it("keeps the count line for a playlist without songs", () => {
    renderHeader({ inviteSongs: { cover: [], names: [], count: 0 }, participantCount: 0 });
    const card = sharedCard();
    expect(card.description).toBe("0곡 등록 | 밴드 곡 투표에 참여하세요!");
    expect(new URL(card.imageUrl).searchParams.get("cover")).toBeNull();
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
