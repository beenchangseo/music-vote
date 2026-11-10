// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KakaoShareButton from "../KakaoShareButton";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

const sendDefault = vi.fn();

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
      render(<KakaoShareButton shareCode="abc123" variant={variant} title="4월 정기 합주" topSong="곡" />);
      click();
      const card = sentCard();
      expect(new URL(card.content.link.webUrl).pathname).toBe("/playlist/abc123");
      expect(new URL(card.buttons[0].link.webUrl).pathname).toBe("/playlist/abc123");
    },
  );

  it.each([
    { variant: "playlist", props: { shareCode: "abc123" } },
    { variant: "decided", props: { shareCode: "abc123" } },
    { variant: "band", props: { linkPath: "/join/aB3_x-9Zq0" } },
  ] as const)("tags the $variant link with kakao / share and the card, never the code", ({ variant, props }) => {
    render(<KakaoShareButton {...props} variant={variant} title="합주" />);
    click();
    const card = sentCard();
    for (const url of [card.content.link.webUrl, card.buttons[0].link.webUrl]) {
      expect(new URL(url).search).toBe(`?utm_source=kakao&utm_medium=share&variant=${variant}`);
    }
  });

  it("opens the setlist card's 셋리스트 보기 on the setlist tab and keeps the kakao / share tags (#80)", () => {
    render(<KakaoShareButton shareCode="abc123" variant="setlist" title="합주" />);
    click();
    const card = sentCard();
    expect(card.buttons[0].title).toBe("셋리스트 보기");
    for (const url of [card.content.link.webUrl, card.buttons[0].link.webUrl]) {
      expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
        utm_source: "kakao",
        utm_medium: "share",
        variant: "setlist",
        tab: "setlist",
      });
    }
  });

  it("sends the band card to the invite link with the exact show date", () => {
    render(
      <KakaoShareButton linkPath="/join/aB3_x-9Zq0" variant="band" title="일코해제" showDate="2026-10-16" members={4} />,
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
    const og = new URL(card.content.imageUrl).searchParams;
    expect(og.get("variant")).toBe("band");
    expect(og.get("date")).toBe("2026-10-16");
    expect(og.get("members")).toBe("4");
  });

  it("drops a past show date from the band card and its image", () => {
    render(
      <KakaoShareButton linkPath="/join/aB3_x-9Zq0" variant="band" title="일코해제" showDate="2026-10-03" members={4} />,
    );
    click();
    const card = sentCard();
    expect(card.content.description).toBe("멤버 4명 · 카카오 로그인 한 번이면 합류");
    expect(new URL(card.content.imageUrl).searchParams.get("date")).toBeNull();
  });

  it("prefixes a band room card with the show date only while the show is ahead", () => {
    render(<KakaoShareButton shareCode="abc123" variant="playlist" title="합주" songs={3} showDate="2026-10-16" />);
    click();
    expect(sentCard().content.description).toBe("10월 16일 공연 · 3곡 등록 · 카카오 로그인 한 번이면 투표 끝");
  });

  it("leaves a room card without a band date untouched", () => {
    render(<KakaoShareButton shareCode="abc123" variant="playlist" title="합주" songs={3} participants={2} />);
    click();
    expect(sentCard().content.description).toBe("3곡 등록 · 2명 참여 중");
  });

  it("counts the candidates on the result card", () => {
    render(<KakaoShareButton shareCode="abc123" variant="decided" title="합주" songs={8} participants={4} topSong="곡" />);
    click();
    expect(sentCard().content.description).toBe("4명 투표 결과 · 8곡 후보 중 1위");
  });
});

describe("KakaoShareButton setlist card (#87, #94)", () => {
  it("says the stage and the setlist's songs and length, not the candidate count, in the card and its image", () => {
    render(
      <KakaoShareButton
        shareCode="abc123"
        variant="setlist"
        title="10월 합주"
        songs={8}
        participants={4}
        setlist={{ stage: "confirmed", songCount: 6, runtimeMinutes: 25 }}
      />,
    );
    click();
    const card = sentCard();
    expect(card.content.title).toBe("🎵 셋리스트 확정 — 10월 합주");
    expect(card.content.description).toBe("총 6곡 · 25분 · 다음 공연 준비 완료");
    const image = new URL(card.content.imageUrl);
    expect(image.pathname).toBe("/api/og");
    expect(Object.fromEntries(image.searchParams)).toEqual({
      variant: "setlist",
      title: "10월 합주",
      stage: "confirmed",
      setlistCount: "6",
      minutes: "25",
      participants: "4",
    });
  });

  it("names the stage the setlist is in", () => {
    render(<KakaoShareButton shareCode="abc123" variant="setlist" title="10월 합주" setlist={{ stage: "building", songCount: 6, runtimeMinutes: null }} />);
    click();
    const card = sentCard();
    expect(card.content.title).toBe("🎵 셋리스트 짜는 중 — 10월 합주");
    expect(card.content.description).toBe("지금 6곡");
  });

  it("leaves the count out while the setlist is unknown, instead of sending the candidate count", () => {
    render(<KakaoShareButton shareCode="abc123" variant="setlist" title="10월 합주" songs={8} participants={4} />);
    click();
    const card = sentCard();
    expect(card.content.title).toBe("🎵 셋리스트 확정 — 10월 합주");
    expect(card.content.description).toBe("셋리스트가 확정됐어요");
    const image = new URL(card.content.imageUrl).searchParams;
    expect(image.get("setlistCount")).toBeNull();
    expect(image.get("stage")).toBeNull();
  });
});

describe("KakaoShareButton without Kakao or the share sheet", () => {
  beforeEach(() => {
    delete window.Kakao;
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  async function copyLink() {
    await act(async () => click());
  }

  it("says the link was copied for 2 seconds", async () => {
    render(<KakaoShareButton shareCode="abc123" variant="playlist" title="합주" />);
    await copyLink();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/playlist/abc123"));
    expect(screen.getByRole("button")).toHaveTextContent("링크를 복사했어요");

    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByRole("button")).toHaveTextContent("링크를 복사했어요");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button")).toHaveTextContent("카카오톡으로 공유");
  });

  it("leaves no timer behind when it unmounts while saying so", async () => {
    const { unmount } = render(<KakaoShareButton shareCode="abc123" variant="playlist" title="합주" />);
    await copyLink();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
