import type { ReactNode } from "react";

interface ScreenToolbarProps {
  /** 이 화면에서 가장 큰 숫자. */
  stat: ReactNode;
  /** 숫자 아래 한 줄. */
  caption?: ReactNode;
  /** 오른쪽 동작. 44px 버튼을 넣는다. */
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
    <div className="sticky top-0 z-20 -mx-4 mt-3 mb-3 border-b border-border bg-bg/95 px-4 pb-3 pt-2 backdrop-blur-sm print:hidden">
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
