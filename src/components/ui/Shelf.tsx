import type { HTMLAttributes } from "react";

/**
 * 가로로 넘기는 선반 (Spotify 홈의 줄). 페이지 좌우 여백(px-4)까지 넘쳐서 카드는 화면 끝에서 잘리고,
 * 첫 카드와 스냅 자리는 본문 왼쪽 선에 선다. 페이지 여백을 지우는 음수 margin 은 이 부품에만 둔다.
 * 항목은 li 이고 폭만 부르는 쪽이 정한다.
 */
export default function Shelf({ className = "", ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={`relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] *:shrink-0 *:snap-start [&::-webkit-scrollbar]:hidden ${className}`}
      {...rest}
    />
  );
}
