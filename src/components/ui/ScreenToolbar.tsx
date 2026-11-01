"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import Button from "./Button";
import { publishScreenToolbarHeight } from "./chrome-inset";

interface ScreenToolbarProps {
  /** 이 화면에서 가장 큰 숫자. */
  stat: ReactNode;
  /** 숫자 아래 한 줄. */
  caption?: ReactNode;
  /** 오른쪽 동작. 버튼은 `ToolbarButton` 만 넣는다. */
  actions?: ReactNode;
  /** 툴바 안쪽, 숫자 아래에 붙는 것 (진행 막대 등). */
  children?: ReactNode;
}

/**
 * 후보곡·셋리스트·합주 세 화면의 상단을 같은 모양으로 맞춘다.
 *
 * 종전에는 화면마다 다른 물건이었다 — 후보곡은 본문 위에 떠 있는 원형 톱니,
 * 셋리스트는 전체 폭 토글 박스, 합주는 같은 톱니인데 내용이 투표 설정이었다.
 * 왼쪽은 그 화면의 핵심 숫자, 오른쪽은 그 화면의 동작으로 고정한다.
 * 스크롤해도 남는다. 세 화면 모두 같은 자리에 같은 높이로 붙는다.
 */
export default function ScreenToolbar({ stat, caption, actions, children }: ScreenToolbarProps) {
  return (
    <div ref={publishScreenToolbarHeight} className="sticky top-0 z-20 -mx-4 mt-3 mb-3 border-b border-border bg-bg/95 px-4 pb-3 pt-2 backdrop-blur-sm print:hidden">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-h3 font-bold leading-tight tabular-nums text-text">{stat}</p>
          {caption && (
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-caption leading-relaxed text-text-muted tabular-nums">
              {caption}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

type ToolbarButtonProps = Omit<ComponentPropsWithRef<"button">, "className" | "children" | "aria-pressed"> & {
  label: string;
  /** 켜고 끄는 동작(편집 ↔ 완료)이 켜진 상태. 켜지면 primary 로 칠하고 aria-pressed 를 단다. */
  pressed?: boolean;
} & (
    | {
        icon: ReactNode;
        /** 640px 아래에서 글자를 숨기고 `size="icon"` 과 같은 정사각이 된다. 스크린 리더는 label 을 읽는다. */
        compact?: boolean;
      }
    | { icon?: never; compact?: never }
  );

/**
 * ScreenToolbar 의 동작 버튼. 툴바 동작은 모두 이것으로 그려서 높이·여백·글자·모서리를 한 곳에서 정한다.
 * 높이는 44px 다. 아이콘만 남는 상태가 IconButton·`size="icon"` 과 같은 44px 정사각이라 누르는 영역을
 * 따로 늘릴 일이 없고, 왼쪽 숫자와 캡션 두 줄도 그 높이라 툴바가 높아지지 않는다.
 */
// One look per row: a mix of filled and bare buttons at the same height reads as different sizes.
export function ToolbarButton({ icon, label, compact = false, pressed, type = "button", ...rest }: ToolbarButtonProps) {
  return (
    <Button type={type} variant="tonal" size={compact ? "toolbar-compact" : "toolbar"} pressed={pressed} {...rest}>
      {icon}
      <span className={compact ? "max-sm:sr-only" : undefined}>{label}</span>
    </Button>
  );
}
