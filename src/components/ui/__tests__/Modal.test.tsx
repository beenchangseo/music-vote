// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DialogProvider, { useDialog } from "../../DialogProvider";
import Modal from "../Modal";

/** Opener button + sheet with two focusable children, like the real sheets. */
function Sheet({ onClose, focusSave = false }: { onClose: () => void; focusSave?: boolean }) {
  const [open, setOpen] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        시트 열기
      </button>
      <Modal
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="곡 블록 수정"
        initialFocus={focusSave ? saveRef : undefined}
      >
        <input aria-label="곡 제목" />
        <button type="button" ref={saveRef}>
          저장
        </button>
      </Modal>
    </>
  );
}

function openSheet(props: { focusSave?: boolean } = {}) {
  const onClose = vi.fn();
  const utils = render(<Sheet onClose={onClose} {...props} />);
  const opener = screen.getByRole("button", { name: "시트 열기" });
  opener.focus();
  fireEvent.click(opener);
  return { ...utils, onClose, opener };
}

describe("Modal — existing behavior (regression contract)", () => {
  beforeEach(() => {
    document.body.style.overflow = "auto";
  });
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("closes on Escape", () => {
    const { onClose } = openSheet();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on a backdrop click but not on a click inside the sheet", () => {
    const { onClose } = openSheet();
    fireEvent.click(screen.getByLabelText("곡 제목"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open and restores the previous value on close", () => {
    openSheet();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(document.body.style.overflow).toBe("auto");
  });

  it("restores body scroll when unmounted while open", () => {
    const { unmount } = openSheet();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("closes from the 닫기 button", () => {
    const { onClose } = openSheet();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog role and title label", () => {
    openSheet();
    expect(screen.getByRole("dialog", { name: "곡 블록 수정" })).toHaveAttribute("aria-modal", "true");
  });
});

describe("Modal — focus management", () => {
  afterEach(cleanup);

  it("focuses the first focusable child, skipping the header close button", () => {
    openSheet();
    expect(screen.getByLabelText("곡 제목")).toHaveFocus();
  });

  it("focuses initialFocus when given", () => {
    openSheet({ focusSave: true });
    expect(screen.getByRole("button", { name: "저장" })).toHaveFocus();
  });

  it("falls back to the close button when children have nothing focusable", () => {
    render(
      <Modal open onClose={vi.fn()} title="안내">
        <p>읽기만 하는 내용</p>
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("cycles Tab from the last element to the first and Shift+Tab back", () => {
    openSheet();
    const close = screen.getByRole("button", { name: "닫기" });
    const save = screen.getByRole("button", { name: "저장" });

    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
  });

  it("leaves Tab between inner elements to the browser", () => {
    openSheet();
    const input = screen.getByLabelText("곡 제목");
    // false would mean the trap called preventDefault.
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
  });

  it("pulls focus back in when it has escaped the sheet", () => {
    const { opener } = openSheet();
    opener.focus();
    fireEvent.keyDown(opener, { key: "Tab" });
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("restores focus to the opener after closing", () => {
    const { opener } = openSheet();
    expect(opener).not.toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(opener).toHaveFocus();
  });

  it("ignores an Escape that an upper layer already handled", () => {
    const { onClose } = openSheet();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
  });
});

/** SetlistItemEditModal's "초기화": a useDialog confirm opened from inside a sheet. */
function SheetWithConfirm({ onClose, onResult }: { onClose: () => void; onResult: (ok: boolean) => void }) {
  const { showConfirm } = useDialog();
  return (
    <Modal open onClose={onClose} title="곡 블록 수정">
      <input aria-label="곡 제목" />
      <button
        type="button"
        onClick={async () => onResult(await showConfirm("투표 리스트의 원본 제목과 시간으로 초기화할까요?"))}
      >
        초기화
      </button>
    </Modal>
  );
}

describe("Modal + useDialog layer rule", () => {
  afterEach(cleanup);

  function openConfirmOverSheet() {
    const onClose = vi.fn();
    const onResult = vi.fn();
    render(
      <DialogProvider>
        <SheetWithConfirm onClose={onClose} onResult={onResult} />
      </DialogProvider>,
    );
    const sheet = screen.getByRole("dialog");
    const reset = screen.getByRole("button", { name: "초기화" });
    reset.focus();
    fireEvent.click(reset);
    const sheetFocus = vi.fn();
    sheet.addEventListener("focusin", sheetFocus);
    return { onClose, onResult, sheet, reset, sheetFocus };
  }

  it("lets Tab reach the confirm buttons instead of the sheet", () => {
    const { sheetFocus } = openConfirmOverSheet();
    const confirm = screen.getByRole("button", { name: "확인" });
    const cancel = screen.getByRole("button", { name: "취소" });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();

    // Middle of the confirm: no layer may hijack the browser's own move.
    expect(fireEvent.keyDown(cancel, { key: "Tab" })).toBe(true);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    expect(sheetFocus).not.toHaveBeenCalled();
  });

  it("closes only the confirm on Escape and returns focus into the sheet", async () => {
    const { onClose, onResult, sheet, reset } = openConfirmOverSheet();
    fireEvent.keyDown(screen.getByRole("button", { name: "확인" }), { key: "Escape" });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet).toBeInTheDocument();
    expect(reset).toHaveFocus();

    // With the confirm gone the sheet owns Escape again.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirms from the keyboard-focused 확인 button", async () => {
    const { onResult } = openConfirmOverSheet();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });
});
