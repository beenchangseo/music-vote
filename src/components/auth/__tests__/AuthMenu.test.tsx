// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DialogProvider from "@/components/ui/DialogProvider";
import AuthMenu from "../AuthMenu";

const actions = vi.hoisted(() => ({ deleteAccount: vi.fn() }));
vi.mock("@/actions/account", () => actions);
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const assign = vi.fn();
const reload = vi.fn();

function openDeleteConfirm() {
  render(
    <DialogProvider>
      <AuthMenu nickname="보컬" avatarUrl={null} />
    </DialogProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "보컬 계정 메뉴" }));
  fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
  return screen.getByRole("alertdialog");
}

beforeEach(() => {
  actions.deleteAccount.mockReset();
  assign.mockReset();
  reload.mockReset();
  vi.stubGlobal("location", { ...window.location, assign, reload });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthMenu 탈퇴하기", () => {
  it("asks first with a danger confirm that says what stays, and does nothing on cancel", () => {
    const dialog = openDeleteConfirm();

    expect(dialog).toHaveTextContent("탈퇴한 멤버");
    expect(dialog).toHaveTextContent(/만든 플레이리스트.*보관/);
    expect(dialog).toHaveTextContent("되돌릴 수 없어요");

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account only on confirm, then lands on the home page", async () => {
    actions.deleteAccount.mockResolvedValue({ success: true });
    const dialog = openDeleteConfirm();

    expect(actions.deleteAccount).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(actions.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("says the sign-in ended and reloads when the session is gone, without claiming a deletion", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "not_logged_in" });
    fireEvent.click(within(openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("로그인이 풀렸어요");
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
  });

  it("says to try again and stays put when the delete fails", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "kakao_unlink_failed" });
    fireEvent.click(within(openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("다시 시도해 주세요");
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("says deletion is unavailable right now without asking to retry soon", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "not_available" });
    fireEvent.click(within(openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("지금은 앱에서 탈퇴할 수 없어요");
    expect(alert).toHaveTextContent("아무것도 지우지 않았어요");
    expect(alert).not.toHaveTextContent("잠시 후");
    expect(assign).not.toHaveBeenCalled();
  });
});
