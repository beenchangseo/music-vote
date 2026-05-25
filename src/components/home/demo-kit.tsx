"use client";

// 홈 데모 섹션 공용 키트: 스크롤 진입 감지 + 가짜 마우스 커서.

import { useEffect, useRef, useState } from "react";

/** 요소가 뷰포트에 들어오면 inView=true, 나가면 false (애니메이션 재생/정지용). */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** 카드(relative) 위에 떠서 % 좌표로 이동하는 가짜 커서. clicking 시 펄스. */
export function DemoCursor({
  x,
  y,
  clicking,
}: {
  x: number;
  y: number;
  clicking: boolean;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 transition-[left,top] duration-700 ease-in-out"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className={`relative transition-transform ${clicking ? "scale-90" : "scale-100"}`}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        >
          <path
            d="M5 2.5l4.7 15.3 2.3-6.2 6.2-2.3z"
            fill="#fff"
            stroke="#111827"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        {clicking && (
          <span className="absolute left-0 top-0 w-5 h-5 rounded-full border-2 border-primary animate-ping" />
        )}
      </div>
    </div>
  );
}

/**
 * target 요소의 중심에 커서 끝(tip)이 닿도록 container 기준 % 좌표를 계산.
 * 하드코딩 % 대신 실제 레이아웃을 측정해 뷰포트·재정렬에도 정확히 맞춘다.
 */
export function pointAt(
  target: HTMLElement,
  container: HTMLElement,
): { x: number; y: number } {
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const TIP_X = 4; // 커서 svg 화살표 끝 오프셋(px)
  const TIP_Y = 2;
  return {
    x: ((t.left + t.width / 2 - c.left - TIP_X) / c.width) * 100,
    y: ((t.top + t.height / 2 - c.top - TIP_Y) / c.height) * 100,
  };
}

/** 취소 가능한 sleep — 데모 시퀀스용. */
export function makeSleeper(cancelledRef: { current: boolean }) {
  return (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(() => resolve(), ms);
      // 취소되면 즉시 resolve (다음 await 가 cancelled 체크하고 종료)
      if (cancelledRef.current) {
        clearTimeout(id);
        resolve();
      }
    });
}
