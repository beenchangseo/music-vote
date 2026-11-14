"use client";

import type { ReactNode } from "react";
import { publishScreenToolbarHeight } from "./chrome-inset";

interface ScreenToolbarProps {
  /** 이 화면에서 가장 큰 숫자. */
  stat: ReactNode;
  /** 숫자 아래 한 줄. */
  caption?: ReactNode;
  /** 툴바 안쪽, 숫자 아래에 붙는 것 (진행 막대 등). */
  children?: ReactNode;
}

/**
 * 화면 위에 붙는 숫자 막대. 그 화면의 핵심 숫자이고 스크롤해도 남는다. 위에 ViewSwitcher 가 붙어 있으면 그 밑에 붙는다.
 * 지금은 합주 탭의 진행(1 / 6)만 쓴다. 후보곡·셋리스트는 앨범 머리와 PlaylistActionRow 로 옮겼다(#101).
 */
export default function ScreenToolbar({ stat, caption, children }: ScreenToolbarProps) {
  return (
    <div ref={publishScreenToolbarHeight} className="sticky top-view-switcher z-20 -mx-4 mt-3 mb-3 border-b border-border bg-bg/95 px-4 pb-3 pt-2 backdrop-blur-sm print:hidden">
      <p className="text-h3 font-bold leading-tight tabular-nums text-text">{stat}</p>
      {caption && (
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-caption leading-relaxed text-text-muted tabular-nums">
          {caption}
        </div>
      )}
      {children}
    </div>
  );
}
