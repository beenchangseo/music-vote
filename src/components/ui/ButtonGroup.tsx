import type { HTMLAttributes } from "react";

/**
 * 나란한 버튼 둘 (Toss "채우기 / 보내기"). 긴 쪽 글자가 반 폭에 들어가면 같은 폭 두 칸이고, 안 들어가면 iOS 알림 버튼처럼
 * 한 줄에 하나씩 꽉 찬 폭으로 쌓인다. 버튼 글자는 줄을 바꾸지 않으니 폭을 글자 아래로 줄이지 않는다(#79).
 * 쌓이면 먼저 쓴 버튼이 위에 온다. 밴드 이름처럼 줄보다 긴 `truncate` 글자는 `Button` 안에서 줄 폭에 맞춰 말줄임된다.
 * `buttonClassName` 링크는 글자 칸이 줄지 않아 줄 밖으로 넘치므로 truncate 글자를 담아 넣지 않는다(eslint).
 */
export default function ButtonGroup({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  // The basis is half the row minus half the gap-2, so two buttons fill one line exactly while both labels fit.
  // fit-content, not max-content: min-width beats max-width, so max-content would push a long truncating label off screen.
  return (
    <div className={`flex flex-wrap gap-2 *:min-w-fit *:grow *:basis-[calc(50%_-_4px)] ${className}`} {...rest}>
      {children}
    </div>
  );
}
