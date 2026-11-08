// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DialogProvider, { useDialog } from "../DialogProvider";
import { MenuItemButton, MenuPanel, useMenu } from "../Menu";

/** A trigger and its panel inside the ref'd wrapper, the way AuthMenu and the band member tile draw them. */
function MemberMenu() {
  const { open, setOpen, ref, triggerRef } = useMenu();
  const { showDanger } = useDialog();
  return (
    <>
      <p>멤버 목록</p>
      <button type="button">초대하기</button>
      <div ref={ref}>
        <button ref={triggerRef} type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          민지 메뉴
        </button>
        {open && (
          <MenuPanel role="menu">
            <MenuItemButton role="menuitem" onClick={() => void showDanger("내보낼까요?")}>
              내보내기
            </MenuItemButton>
          </MenuPanel>
        )}
      </div>
    </>
  );
}

function openMenu() {
  render(
    <DialogProvider>
      <MemberMenu />
    </DialogProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "민지 메뉴" }));
  expect(screen.getByRole("menu")).toBeInTheDocument();
}

const escape = (target: Element = document.body) => fireEvent.keyDown(target, { key: "Escape" });
const trigger = () => screen.getByRole("button", { name: "민지 메뉴" });
const item = () => screen.getByRole("menuitem", { name: "내보내기" });
const otherControl = () => screen.getByRole("button", { name: "초대하기" });

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-dialog-layer]").forEach((el) => el.remove());
});

describe("useMenu", () => {
  it("closes on a press outside the trigger and panel, and stays open on a press inside them", () => {
    openMenu();
    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "내보내기" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "민지 메뉴" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText("멤버 목록"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "민지 메뉴" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on a press outside without pulling focus back to the trigger", () => {
    openMenu();
    item().focus();
    fireEvent.pointerDown(screen.getByText("멤버 목록"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).not.toHaveFocus();
  });

  it.each([
    { from: "a menu item", place: () => item().focus(), to: "the trigger", expected: trigger },
    { from: "the trigger", place: () => trigger().focus(), to: "the trigger", expected: trigger },
    { from: "nowhere (it fell to the body)", place: () => (document.activeElement as HTMLElement | null)?.blur(), to: "the trigger", expected: trigger },
    { from: "another control on the page", place: () => otherControl().focus(), to: "that control", expected: otherControl },
  ])("closes on Escape with focus on $from and leaves focus on $to", ({ place, expected }) => {
    openMenu();
    place();
    escape(document.activeElement ?? document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(expected()).toHaveFocus();
  });

  it("stays open behind a confirm it opened: presses and Escape go to the confirm first", () => {
    openMenu();
    item().focus();
    fireEvent.click(item());
    const confirm = screen.getByRole("alertdialog");

    fireEvent.pointerDown(confirm);
    escape(confirm);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(item()).toHaveFocus();

    escape(item());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it.each([
    [
      "a key another handler already took",
      () => {
        document.body.addEventListener("keydown", (e) => e.preventDefault(), { once: true });
        escape();
      },
    ],
    [
      "a dialog layer that is still up",
      () => {
        const layer = document.createElement("div");
        layer.setAttribute("data-dialog-layer", "");
        document.body.append(layer);
        escape();
        fireEvent.pointerDown(document.body);
      },
    ],
  ])("ignores input that belongs to %s", (_, act) => {
    openMenu();
    act();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
