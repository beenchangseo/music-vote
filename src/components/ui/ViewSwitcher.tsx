"use client";

import SegmentedControl, { type SegmentOption } from "./SegmentedControl";
import { publishViewSwitcherHeight } from "./chrome-inset";

interface ViewSwitcherProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** 바깥 배치(margin)만. */
  className?: string;
}

/**
 * 한 화면의 보기를 바꾸는 줄 (플레이리스트의 후보곡 · 셋리스트 · 합주, #110). SegmentedControl 이라 라디오 묶음이다.
 * 스크롤해 지나가면 화면 위에 붙어서 긴 목록 끝에서도 한 번에 보기를 바꾼다. 붙는 높이를 --view-switcher-height 로 알리고,
 * 그 아래 붙는 막대(합주의 ScreenToolbar, 편집 중인 셋리스트 동작 줄)는 top-view-switcher 로 이 줄 밑에 선다.
 * 붙었을 때 바탕이 화면 끝까지 닿도록 페이지 여백(px-4)만큼 양옆으로 편다.
 */
export default function ViewSwitcher<T extends string>({ className = "", ...control }: ViewSwitcherProps<T>) {
  return (
    <div ref={publishViewSwitcherHeight} className={`sticky top-0 z-20 -mx-4 bg-bg px-4 py-2 print:hidden ${className}`}>
      <SegmentedControl {...control} />
    </div>
  );
}
