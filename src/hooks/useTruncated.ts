"use client";

import { useCallback, useState } from "react";

/**
 * truncate 로 줄인 칸의 글자가 지금 실제로 잘렸는지. 칸 크기가 바뀔 때마다(화면 회전, 글꼴 교체, 글자 변경) 다시 잰다.
 * 글자 수로 어림하면 좁은 화면에서 잘린 짧은 제목을 펼칠 수 없다(#70).
 */
export function useTruncated<T extends HTMLElement>(): [ref: (el: T | null) => (() => void) | undefined, truncated: boolean] {
  const [truncated, setTruncated] = useState(false);
  const ref = useCallback((el: T | null) => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setTruncated(el.scrollWidth > el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, truncated];
}
