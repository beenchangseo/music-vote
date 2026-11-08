// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DialogProvider from "../../ui/DialogProvider";
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

    fireEvent.click(screen.getByRole("button", { name: "셋리스트 내보내기" }));

    expect(screen.getByRole("button", { name: /링크 공유/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /이미지로 저장/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF로 저장/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "인쇄" })).not.toBeInTheDocument();
  });
});

describe("SetlistShareButton link (#80)", () => {
  afterEach(() => {
    cleanup();
    delete (navigator as { share?: unknown }).share;
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  async function shareLink() {
    render(
      <DialogProvider>
        <SetlistShareButton shareCode="share-code" title="테스트 합주" />
      </DialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "셋리스트 내보내기" }));
    fireEvent.click(screen.getByRole("button", { name: /링크 공유/ }));
  }

  function expectSetlistLink(url: string) {
    const link = new URL(url);
    expect(link.pathname).toBe("/playlist/share-code");
    expect(Object.fromEntries(link.searchParams)).toEqual({ tab: "setlist" });
  }

  it("sends the share sheet a link that opens the setlist tab", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    await shareLink();

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expectSetlistLink(share.mock.calls[0][0].url);
  });

  it("copies a link that opens the setlist tab when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    await shareLink();

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expectSetlistLink(writeText.mock.calls[0][0]);
  });
});
