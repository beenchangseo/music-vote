// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NoticeCard from "../NoticeCard";
import InlineNotice from "../InlineNotice";

afterEach(cleanup);

describe("NoticeCard", () => {
  it("shows its title, body and actions and closes from a named button", () => {
    const onDismiss = vi.fn();
    render(
      <NoticeCard title="밴드를 만들었어요" onDismiss={onDismiss} actions={<button type="button">밴드 홈</button>}>
        일코해제 · 멤버 4명
      </NoticeCard>,
    );
    expect(screen.getByText("밴드를 만들었어요")).toBeInTheDocument();
    expect(screen.getByText("일코해제 · 멤버 4명")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "밴드 홈" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("lets the caller name the close button", () => {
    const onDismiss = vi.fn();
    render(
      <NoticeCard onDismiss={onDismiss} dismissLabel="닫기">
        안내
      </NoticeCard>,
    );
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("InlineNotice", () => {
  it("has no close button: it stays while its state holds", () => {
    render(<InlineNotice>보관된 플레이리스트예요.</InlineNotice>);
    expect(screen.getByText("보관된 플레이리스트예요.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
