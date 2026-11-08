import type { HTMLAttributes } from "react";

/**
 * 나란한 버튼 둘 (Toss "채우기 / 보내기"). 긴 쪽 글자가 반 폭에 들어가면 같은 폭 두 칸이고, 안 들어가면 iOS 알림 버튼처럼
 * 한 줄에 하나씩 꽉 찬 폭으로 쌓인다. 버튼 글자는 줄을 바꾸지 않으니 폭을 글자 아래로 줄이지 않는다(#79).
 * 쌓이면 먼저 쓴 버튼이 위에 온다.
 */
export default function ButtonGroup({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  // The basis is half the row minus half the gap-2, so two buttons fill one line exactly while both labels fit.
  return (
    <div className={`flex flex-wrap gap-2 *:min-w-max *:grow *:basis-[calc(50%_-_4px)] ${className}`} {...rest}>
      {children}
    </div>
  );
}
