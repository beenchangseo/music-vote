// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "../../sitemap";
import SupportPage, { metadata } from "../page";

const CHAT_URL = "https://pf.kakao.com/_abcde/chat";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("/support", () => {
  it("answers the common questions before the chat: login, anonymous voting, setlist editing", () => {
    render(<SupportPage />);
    const questions = [...document.querySelectorAll("details summary")].map((summary) => summary.textContent ?? "");

    expect(questions.some((q) => /로그인/.test(q))).toBe(true);
    expect(questions.some((q) => /익명/.test(q))).toBe(true);
    expect(questions.some((q) => /셋리스트/.test(q))).toBe(true);
    for (const details of document.querySelectorAll("details")) {
      expect(details.querySelector("p")?.textContent?.length).toBeGreaterThan(0);
    }
  });

  it("says where to leave the service and what is erased or kept", () => {
    render(<SupportPage />);
    const entry = [...document.querySelectorAll("details")].find((details) =>
      /탈퇴/.test(details.querySelector("summary")?.textContent ?? ""),
    );
    const answer = entry?.querySelector("p")?.textContent ?? "";

    expect(answer).toContain("'탈퇴하기'");
    expect(answer).toMatch(/투표와 댓글.*지워/);
    expect(answer).toContain("탈퇴한 멤버");
    expect(answer).toContain("되돌릴 수 없어요");
  });

  it("links to the KakaoTalk channel chat when the channel URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL", CHAT_URL);
    render(<SupportPage />);

    expect(screen.getByRole("link", { name: /카카오톡으로 문의하기/ })).toHaveAttribute("href", CHAT_URL);
    expect(screen.queryByText("카카오톡 채널을 준비하고 있어요")).not.toBeInTheDocument();
  });

  it.each([
    ["unset", ""],
    ["not a URL", "pf.kakao.com/_abcde/chat"],
    ["not https", "javascript:alert(1)"],
  ])("says the channel is not ready, with no link, when the URL is %s", (_label, value) => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL", value);
    render(<SupportPage />);

    expect(screen.getByRole("button", { name: /카카오톡 채널을 준비하고 있어요/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /카카오톡으로 문의하기/ })).not.toBeInTheDocument();
  });

  it("has its own canonical address and is in the sitemap", () => {
    expect(metadata.alternates?.canonical).toBe("/support");
    expect(sitemap().map((entry) => entry.url)).toContain("https://plypick.kr/support");
  });
});
