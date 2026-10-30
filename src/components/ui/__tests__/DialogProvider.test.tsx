// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DialogProvider, { useDialog } from "../DialogProvider";

type Dialog = ReturnType<typeof useDialog>;

function Trigger({ run }: { run: (dialog: Dialog) => Promise<unknown> }) {
  const dialog = useDialog();
  return (
    <button type="button" onClick={() => void run(dialog)}>
      여는 버튼
    </button>
  );
}

/** Opens a dialog from a focused button, the way every call site does. */
function open<T>(run: (dialog: Dialog) => Promise<T>) {
  const spy = vi.fn(run);
  render(
    <DialogProvider>
      <Trigger run={spy} />
    </DialogProvider>,
  );
  const opener = screen.getByRole("button", { name: "여는 버튼" });
  opener.focus();
  fireEvent.click(opener);
  return { result: spy.mock.results[0].value as Promise<T>, opener };
}

describe("DialogProvider modal contract", () => {
  afterEach(cleanup);

  it("exposes an alertdialog labelled by its title and described by its message", () => {
    open((d) => d.showConfirm("투표한 멤버 닉네임이 모두에게 보이게 됩니다.", "기명 투표로 전환"));
    const dialog = screen.getByRole("alertdialog", { name: "기명 투표로 전환" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-dialog-layer");
    expect(dialog).toHaveAccessibleDescription("투표한 멤버 닉네임이 모두에게 보이게 됩니다.");
  });

  it("cycles Tab inside the dialog", () => {
    open((d) => d.showConfirm("계속할까요?"));
    const cancel = screen.getByRole("button", { name: "취소" });
    const confirm = screen.getByRole("button", { name: "확인" });

    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it("pulls Tab back into the dialog when focus is outside", () => {
    const { opener } = open((d) => d.showConfirm("계속할까요?"));
    opener.focus();
    fireEvent.keyDown(opener, { key: "Tab" });
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("treats Escape as cancel for showConfirm", async () => {
    const { result } = open((d) => d.showConfirm("계속할까요?"));
    fireEvent.keyDown(document, { key: "Escape" });

    await expect(result).resolves.toBe(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("treats Escape as cancel for showDanger", async () => {
    const { result } = open((d) => d.showDanger("댓글을 삭제하시겠습니까?"));
    fireEvent.keyDown(document, { key: "Escape" });

    await expect(result).resolves.toBe(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("closes showAlert on Escape", async () => {
    const { result } = open((d) => d.showAlert("저장에 실패했습니다."));
    fireEvent.keyDown(document, { key: "Escape" });

    await expect(result).resolves.toBeUndefined();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("focuses 취소 first for showDanger", () => {
    open((d) => d.showDanger("이 항목을 삭제하시겠습니까?"));
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("focuses 확인 first for showConfirm and showAlert", () => {
    open((d) => d.showConfirm("계속할까요?"));
    expect(screen.getByRole("button", { name: "확인" })).toHaveFocus();
    cleanup();

    open((d) => d.showAlert("모든 투표를 초기화했어요."));
    expect(screen.getByRole("button", { name: "확인" })).toHaveFocus();
  });

  it("restores focus to the opener when it closes", async () => {
    const { result, opener } = open((d) => d.showDanger("이 항목을 삭제하시겠습니까?"));
    expect(opener).not.toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await expect(result).resolves.toBe(true);
    expect(opener).toHaveFocus();
  });
});

describe("DialogProvider options", () => {
  afterEach(cleanup);

  it("passes title and confirmLabel through to showDanger", async () => {
    const { result } = open((d) =>
      d.showDanger("홈의 '내 밴드'와 멤버 목록에서 빠져요.", { title: "새벽밴드에서 나갈까요?", confirmLabel: "나가기" }),
    );

    expect(screen.getByRole("alertdialog", { name: "새벽밴드에서 나갈까요?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    await expect(result).resolves.toBe(true);
  });

  it("keeps the 삭제 확인 / 삭제 defaults for existing showDanger calls", () => {
    open((d) => d.showDanger("댓글을 삭제하시겠습니까?"));

    expect(screen.getByRole("alertdialog", { name: "삭제 확인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("still reads a positional string as the title", () => {
    open((d) => d.showDanger("플레이리스트와 모든 곡·투표·셋리스트가 삭제돼요.", "플레이리스트 삭제"));

    expect(screen.getByRole("alertdialog", { name: "플레이리스트 삭제" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("accepts confirmLabel on showConfirm and keeps its defaults otherwise", () => {
    open((d) => d.showConfirm("새 링크를 만들까요?", { confirmLabel: "새로 만들기" }));

    expect(screen.getByRole("alertdialog", { name: "확인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로 만들기" })).toHaveFocus();
  });
});
