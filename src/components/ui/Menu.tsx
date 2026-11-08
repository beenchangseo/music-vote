import Link from "next/link";
import type { ComponentProps, ComponentPropsWithRef, HTMLAttributes } from "react";

type Tone = "default" | "danger";

/**
 * 눌러 여는 작은 메뉴 판. 트리거와 같은 relative 부모 안에 두면 트리거 바로 아래, 오른쪽 끝에 맞춰 선다.
 * 폭은 부르는 쪽이 className 으로 준다. 항목은 MenuItemButton·MenuItemLink 다.
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
  "flex min-h-control-md w-full items-center px-4 text-left text-sm transition-colors hover:bg-surface-hover " +
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
