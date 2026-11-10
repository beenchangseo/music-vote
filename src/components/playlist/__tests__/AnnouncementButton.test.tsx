// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnnouncementButton from "../AnnouncementButton";

vi.mock("@/actions/playlist", () => ({ updateAnnouncementPublic: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

afterEach(cleanup);

describe("AnnouncementButton", () => {
  it("opens its sheet outside the button row, so a query-container row cannot trap the fixed overlay", () => {
    const { container } = render(
      <div data-testid="row">
        <AnnouncementButton playlistId="p" announcement="합주 7시" shareCode="abc" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));

    const field = screen.getByPlaceholderText("멤버에게 알릴 내용");
    expect(field).toBeInTheDocument();
    expect(container.contains(field)).toBe(false);
    expect(field).toHaveValue("합주 7시");
  });

  const field = () => screen.getByPlaceholderText("멤버에게 알릴 내용");

  function editThenClose(announcement: string) {
    const utils = render(<AnnouncementButton playlistId="p" announcement={announcement} shareCode="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));
    fireEvent.change(field(), { target: { value: "합주 8시로 바꿔요" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "공지사항" })).not.toBeInTheDocument();
    return utils;
  }

  it("keeps an unsaved edit when the sheet closes and opens again", () => {
    const { rerender } = editThenClose("합주 7시");
    // A refetch that brings back the same announcement leaves the draft alone.
    rerender(<AnnouncementButton playlistId="p" announcement="합주 7시" shareCode="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));

    expect(field()).toHaveValue("합주 8시로 바꿔요");
  });

  it("drops the draft and shows the newer announcement when another member saved one meanwhile", () => {
    const { rerender } = editThenClose("합주 7시");
    rerender(<AnnouncementButton playlistId="p" announcement="오늘 합주 취소" shareCode="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));

    expect(field()).toHaveValue("오늘 합주 취소");
  });

  it("compares with the announcement the draft started from, not the one seen at the last keystroke", () => {
    const { rerender } = render(<AnnouncementButton playlistId="p" announcement="합주 7시" shareCode="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));
    fireEvent.change(field(), { target: { value: "합주 8시" } });
    rerender(<AnnouncementButton playlistId="p" announcement="오늘 합주 취소" shareCode="abc" />);
    fireEvent.change(field(), { target: { value: "합주 8시로 바꿔요" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));

    expect(field()).toHaveValue("오늘 합주 취소");
  });
});
