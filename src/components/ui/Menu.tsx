"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps, type ComponentPropsWithRef, type HTMLAttributes } from "react";
import { dialogLayerOpen } from "./focus-trap";

type Tone = "default" | "danger";

/**
 * 메뉴가 열렸는지와 닫는 규칙. 트리거와 MenuPanel 을 같이 감싼 요소에 ref 를 달면, 그 밖을 누르거나 포커스가 어디 있든
 * Esc 를 누를 때 닫힌다.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Same rule as Modal: while a confirm from the menu is up, input belongs to the confirm, so the menu stays open behind it.
    // pointerdown, not mousedown: iOS Safari sends no mouse events for a tap on a non-clickable spot.
    function onPointerDown(e: PointerEvent) {
      if (dialogLayerOpen()) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || dialogLayerOpen()) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}

/**
 * 눌러 여는 작은 메뉴 판. 트리거와 같은 relative 부모 안에 두면 트리거 바로 아래, 오른쪽 끝에 맞춰 선다.
 * 폭은 부르는 쪽이 className 으로 준다. 항목은 MenuItemButton·MenuItemLink 다. 여닫기는 useMenu 가 맡는다.
 */
export function MenuPanel({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  // z-40: a menu rendered outside the fixed z-50 slot (the playlist header) still paints over the positioned cover
  // below it, and stays under sheets (z-[90]).
  return (
    <div
      className={`absolute right-0 top-full z-40 overflow-hidden rounded-control border border-border bg-surface shadow-float animate-fade-in ${className}`}
      {...rest}
    />
  );
}

const TONE: Record<Tone, string> = {
  default: "text-text-muted hover:text-text",
  danger: "text-danger-fg",
};

// The panel clips its overflow, which would cut off the global focus outline, so the focus ring is drawn inside.
const ITEM =
  "flex min-h-control-md w-full items-center whitespace-nowrap px-4 text-left text-sm transition-colors hover:bg-surface-hover " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/** 메뉴 한 줄 (44px). 위험한 동작은 tone="danger". */
export function MenuItemButton({ tone = "default", type = "button", ...rest }: Omit<ComponentPropsWithRef<"button">, "className"> & { tone?: Tone }) {
  return <button type={type} className={`${ITEM} ${TONE[tone]}`} {...rest} />;
}

/** 다른 화면으로 가는 메뉴 한 줄. 모양은 MenuItemButton 과 같다. */
export function MenuItemLink({ tone = "default", ...rest }: Omit<ComponentProps<typeof Link>, "className"> & { tone?: Tone }) {
  return <Link className={`${ITEM} ${TONE[tone]}`} {...rest} />;
}
