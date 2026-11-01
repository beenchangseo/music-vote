// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolbarButton } from "../ScreenToolbar";

describe("ToolbarButton", () => {
  afterEach(cleanup);

  it("announces the toggle state only when given one", () => {
    render(
      <>
        <ToolbarButton label="편집" pressed={false} />
        <ToolbarButton label="완료" pressed />
        <ToolbarButton label="내보내기" />
      </>,
    );
    expect(screen.getByRole("button", { name: "편집" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "완료" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "내보내기" })).not.toHaveAttribute("aria-pressed");
  });

  it("keeps the label for screen readers when compact hides it on a phone", () => {
    render(<ToolbarButton label="셋리 전체 듣기" compact icon={<svg aria-hidden />} />);
    expect(screen.getByRole("button", { name: "셋리 전체 듣기" })).toBeInTheDocument();
  });
});
