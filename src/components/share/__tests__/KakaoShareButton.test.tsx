// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KakaoShareButton from "../KakaoShareButton";
import type { CardImage } from "@/domain/share-card";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

const sendDefault = vi.fn();
// What the page signed for this button (src/lib/share-card.ts). The button never builds one.
const IMAGE = "/api/og?card=v1.payload.signature" as CardImage;

type SentCard = {
  content: { title: string; description: string; imageUrl: string; link: { webUrl: string } };
  buttons: { title: string; link: { webUrl: string } }[];
};

function sentCard(): SentCard {
  expect(sendDefault).toHaveBeenCalledTimes(1);
  return sendDefault.mock.calls[0][0] as SentCard;
}

function click() {
  fireEvent.click(screen.getByRole("button"));
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

describe("KakaoShareButton links", () => {
  it.each(["playlist", "decided", "setlist"] as const)(
    "keeps the %s card on /playlist/{shareCode}",
    (variant) => {
      render(<KakaoShareButton shareCode="abc123" variant={variant} title="4월 정기 합주" image={IMAGE} />);
      click();
      const card = sentCard();
      expect(new URL(card.content.link.webUrl).pathname).toBe("/playlist/abc123");
      expect(new URL(card.buttons[0].link.webUrl).pathname).toBe("/playlist/abc123");
    },
  );

  it("sends the band card to the invite link with the exact show date", () => {
    render(
      <KakaoShareButton linkPath="/join/aB3_x-9Zq0" variant="band" title="일코해제" showDate="2026-10-16" members={4} image={IMAGE} />,
    );
    click();
    const card = sentCard();
    expect(new URL(card.content.link.webUrl).pathname).toBe("/join/aB3_x-9Zq0");
    expect(new URL(card.buttons[0].link.webUrl).pathname).toBe("/join/aB3_x-9Zq0");
    expect(card.content.title).toBe("🎸 일코해제");
    expect(card.content.description).toBe("10월 16일(금) 공연 · 멤버 4명");
    expect(card.content.description).not.toMatch(/D-/);
    expect(card.buttons[0].title).toBe("밴드 들어가기");

    // Without the size Kakao crops the 1200×630 card to a near-square and cuts the band name.
    expect(card.content).toMatchObject({ imageWidth: 1200, imageHeight: 630 });
  });

  it("sends the picture the server signed, under this site's origin, as is", () => {
    render(<KakaoShareButton shareCode="abc123" variant="decided" title="합주" image={IMAGE} />);
    click();
    expect(sentCard().content.imageUrl).toBe(`${window.location.origin}${IMAGE}`);
  });

  it("drops a past show date from the band card text", () => {
    render(
      <KakaoShareButton linkPath="/join/aB3_x-9Zq0" variant="band" title="일코해제" showDate="2026-10-03" members={4} image={IMAGE} />,
    );
    click();
    expect(sentCard().content.description).toBe("멤버 4명 · 카카오 로그인 한 번이면 합류");
  });

  it("prefixes a band room card with the show date only while the show is ahead", () => {
    render(<KakaoShareButton shareCode="abc123" variant="playlist" title="합주" songs={3} showDate="2026-10-16" image={IMAGE} />);
    click();
    expect(sentCard().content.description).toBe("10월 16일 공연 · 3곡 등록 · 카카오 로그인 한 번이면 투표 끝");
  });

  it("leaves a room card without a band date untouched", () => {
    render(<KakaoShareButton shareCode="abc123" variant="playlist" title="합주" songs={3} participants={2} image={IMAGE} />);
    click();
    expect(sentCard().content.description).toBe("3곡 등록 · 2명 참여 중");
  });
});
