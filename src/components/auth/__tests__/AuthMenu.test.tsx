// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DialogProvider from "@/components/ui/DialogProvider";
import AuthMenu from "../AuthMenu";

const actions = vi.hoisted(() => ({ deleteAccount: vi.fn(), previewAccountDeletion: vi.fn() }));
vi.mock("@/actions/account", () => actions);
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const assign = vi.fn();
const reload = vi.fn();

function openMenu() {
  render(
    <DialogProvider>
      <AuthMenu nickname="보컬" avatarUrl={null} />
    </DialogProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "보컬 계정 메뉴" }));
}

function pressDelete() {
  openMenu();
  fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
}

async function openDeleteConfirm() {
  pressDelete();
  return screen.findByRole("alertdialog");
}

beforeEach(() => {
  actions.deleteAccount.mockReset();
  actions.previewAccountDeletion.mockReset().mockResolvedValue({ success: true, handovers: [] });
  assign.mockReset();
  reload.mockReset();
  vi.stubGlobal("location", { ...window.location, assign, reload });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthMenu 문의하기", () => {
  it("links to /support and closes the menu on the way out", () => {
    openMenu();

    const link = screen.getByRole("link", { name: "문의하기" });
    expect(link).toHaveAttribute("href", "/support");

    // jsdom cannot load another document; the menu closing is what this test watches.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.queryByRole("link", { name: "문의하기" })).not.toBeInTheDocument();
  });
});

describe("AuthMenu 탈퇴하기", () => {
  it("asks first with a danger confirm that says what stays, and does nothing on cancel", async () => {
    const dialog = await openDeleteConfirm();

    expect(dialog).toHaveTextContent("탈퇴한 멤버");
    expect(dialog).toHaveTextContent(/만든 플레이리스트.*보관/);
    expect(dialog).toHaveTextContent("되돌릴 수 없어요");
    expect(dialog).not.toHaveTextContent("맡아요");

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account only on confirm, then lands on the home page", async () => {
    actions.deleteAccount.mockResolvedValue({ success: true });
    const dialog = await openDeleteConfirm();

    expect(actions.deleteAccount).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(actions.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("says the sign-in ended and reloads when the session is gone, without claiming a deletion", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "not_logged_in" });
    fireEvent.click(within(await openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("로그인이 풀렸어요");
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
  });

  it("says to try again and stays put when the delete fails", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "kakao_unlink_failed" });
    fireEvent.click(within(await openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("다시 시도해 주세요");
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("names each band I hand over and who takes it, before anything is deleted", async () => {
    actions.previewAccountDeletion.mockResolvedValue({
      success: true,
      handovers: [
        { bandName: "주말밴드", ownerName: "기타" },
        { bandName: "평일밴드", ownerName: "드럼" },
      ],
    });
    const dialog = await openDeleteConfirm();

    expect(dialog).toHaveTextContent("'주말밴드' 밴드는 기타님이 리더를 맡아요.");
    expect(dialog).toHaveTextContent("'평일밴드' 밴드는 드럼님이 리더를 맡아요.");
    expect(dialog).toHaveTextContent("되돌릴 수 없어요");
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("does not open the confirm when it cannot tell who takes over my bands", async () => {
    actions.previewAccountDeletion.mockResolvedValue({ success: false, reason: "read_failed" });
    pressDelete();

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("다시 시도해 주세요");
    expect(alert).not.toHaveTextContent("되돌릴 수 없어요");
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("says deletion is unavailable right now without asking to retry soon", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "not_available" });
    fireEvent.click(within(await openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("지금은 앱에서 탈퇴할 수 없어요");
    expect(alert).toHaveTextContent("아무것도 지우지 않았어요");
    expect(alert).not.toHaveTextContent("잠시 후");
    expect(assign).not.toHaveBeenCalled();
  });

  it("points to 문의하기 when deletion is unavailable, and the link is still in the menu after the alert", async () => {
    actions.deleteAccount.mockResolvedValue({ success: false, reason: "not_available" });
    fireEvent.click(within(await openDeleteConfirm()).getByRole("button", { name: "탈퇴하기" }));

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("'문의하기'");
    fireEvent.click(within(alert).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/support");
  });
});
