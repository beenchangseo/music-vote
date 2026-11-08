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
    fireEvent.click(send);
    expect(send).toHaveAttribute("aria-checked", "false");
    expect(isGaOptedOut()).toBe(true);
  });
});
