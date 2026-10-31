import type { HTMLAttributes } from "react";

/** 나란한 버튼 둘을 같은 폭·같은 높이로 (Toss "채우기 / 보내기"). 주 동작은 오른쪽에 둔다. */
export default function ButtonGroup({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex gap-2 *:min-w-0 *:flex-1 ${className}`} {...rest}>
      {children}
    </div>
  );
}
