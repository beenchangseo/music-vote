// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PrivacyPage from "../page";

afterEach(cleanup);

describe("/privacy", () => {
  it.each([["5. 이용자의 권리와 탈퇴"], ["6. 개인정보 보호책임자"]])("sends questions in '%s' to the support page", (heading) => {
    render(<PrivacyPage />);
    const section = screen.getByRole("heading", { name: heading }).closest("section");

    expect(within(section!).getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/support");
  });
});
