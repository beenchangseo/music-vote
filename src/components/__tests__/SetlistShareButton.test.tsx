// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DialogProvider from "../DialogProvider";
import SetlistShareButton from "../SetlistShareButton";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

describe("SetlistShareButton", () => {
  afterEach(cleanup);

  it("opens the three requested sharing and file options", () => {
    render(
      <DialogProvider>
        <SetlistShareButton shareCode="share-code" title="테스트 합주" />
      </DialogProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "셋리스트 공유 및 저장" }));

    expect(screen.getByRole("button", { name: /링크 공유/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /이미지로 저장/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF로 저장/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "인쇄" })).not.toBeInTheDocument();
  });
});
