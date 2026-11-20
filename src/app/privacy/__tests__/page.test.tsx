// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isGaOptedOut, setGaOptedOut } from "@/lib/ga-opt-out";
import PrivacyPage from "../page";

afterEach(() => {
  cleanup();
  setGaOptedOut(false);
});

describe("/privacy", () => {
  it.each([["5. 이용자의 권리와 탈퇴"], ["6. 개인정보 보호책임자"]])("sends questions in '%s' to the support page", (heading) => {
    render(<PrivacyPage />);
    const section = screen.getByRole("heading", { name: heading }).closest("section");

    expect(within(section!).getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/support");
  });

  it("lets a visitor turn Google Analytics off where the policy describes it", () => {
    render(<PrivacyPage />);
    const section = screen.getByRole("heading", { name: "3. 개인정보의 보유 및 파기" }).closest("section");

    const send = within(section!).getByRole("switch", { name: "Google 애널리틱스로 사용 통계 보내기" });
    expect(send).toHaveAttribute("aria-checked", "true");
    // Turning it off reloads a page that loaded GTM, so the switch says so before it is pressed.
    expect(send).toHaveAccessibleDescription("이 브라우저에서만 적용돼요. 끄면 열린 화면을 새로 고쳐 바로 멈춰요.");
    fireEvent.click(send);
    expect(send).toHaveAttribute("aria-checked", "false");
    expect(isGaOptedOut()).toBe(true);
  });

  it("names Google 태그 관리자 as what loads Google Analytics, among the processors", () => {
    render(<PrivacyPage />);
    const section = screen.getByRole("heading", { name: "4. 개인정보의 제3자 제공과 처리 위탁" }).closest("section");

    expect(within(section!).getByText("Google: 사용 흐름 통계(Google 태그 관리자로 싣는 Google 애널리틱스)")).toBeInTheDocument();
  });
});
