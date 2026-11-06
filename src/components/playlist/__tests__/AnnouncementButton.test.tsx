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

    const field = screen.getByPlaceholderText("멤버들에게 전달할 공지사항을 작성하세요");
    expect(field).toBeInTheDocument();
    expect(container.contains(field)).toBe(false);
    expect(field).toHaveValue("합주 7시");
  });

  it("keeps an unsaved edit when the sheet closes and opens again", () => {
    render(<AnnouncementButton playlistId="p" announcement="합주 7시" shareCode="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));
    fireEvent.change(screen.getByPlaceholderText("멤버들에게 전달할 공지사항을 작성하세요"), { target: { value: "합주 8시로 바꿔요" } });

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "공지사항" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "공지사항" }));

    expect(screen.getByPlaceholderText("멤버들에게 전달할 공지사항을 작성하세요")).toHaveValue("합주 8시로 바꿔요");
  });
});
