// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DialogProvider, { useDialog } from "../DialogProvider";
import { MenuItemButton, MenuPanel, useMenu } from "../Menu";

/** A trigger and its panel inside the ref'd wrapper, the way AuthMenu and the band member tile draw them. */
function MemberMenu() {
  const { open, setOpen, ref } = useMenu();
  const { showDanger } = useDialog();
  return (
    <>
      <p>멤버 목록</p>
      <div ref={ref}>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
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

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-dialog-layer]").forEach((el) => el.remove());
});

describe("useMenu", () => {
  it("closes on a press outside the trigger and panel, and stays open on a press inside them", () => {
    openMenu();
    fireEvent.mouseDown(screen.getByRole("menuitem", { name: "내보내기" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "민지 메뉴" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("멤버 목록"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "민지 메뉴" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape even when focus is outside the menu", () => {
    openMenu();
    (document.activeElement as HTMLElement | null)?.blur();
    escape();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays open behind a confirm it opened: presses and Escape go to the confirm first", () => {
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "내보내기" }));
    const confirm = screen.getByRole("alertdialog");

    fireEvent.mouseDown(confirm);
    escape(confirm);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    escape();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
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
        fireEvent.mouseDown(document.body);
      },
    ],
  ])("ignores input that belongs to %s", (_, act) => {
    openMenu();
    act();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
