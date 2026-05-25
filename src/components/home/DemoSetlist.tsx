"use client";

// 섹션4 — 셋리스트에 인터벌 블록(인터미션·멘트)을 끼워 공연 순서를 계획.
// 커서가 "인터벌 블록 추가"를 눌러 블록이 사이에 끼워지고 순서가 다시 매겨진다.

import { useEffect, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useInView, prefersReducedMotion, DemoCursor, pointAt } from "./demo-kit";

interface Item {
  id: string;
  kind: "song" | "interval";
  title: string;
  sub?: string;
}

const SONGS: Item[] = [
  { id: "s1", kind: "song", title: "낭만고양이", sub: "체리필터" },
  { id: "s2", kind: "song", title: "예뻤어", sub: "DAY6" },
  { id: "s3", kind: "song", title: "벚꽃 엔딩", sub: "버스커 버스커" },
];
const I1: Item = { id: "i1", kind: "interval", title: "인터미션", sub: "10분" };
const I2: Item = { id: "i2", kind: "interval", title: "마지막 멘트", sub: "3분" };

export default function DemoSetlist() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [items, setItems] = useState<Item[]>(SONGS);
  const [caption, setCaption] = useState("");
  const [cursor, setCursor] = useState({ x: 50, y: 86 });
  const [clicking, setClicking] = useState(false);
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 340, easing: "ease-in-out" });
  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    // 취소 플래그는 effect 실행마다 지역 변수로 격리 (공유 ref 를 리셋하면
    // StrictMode/HMR 재실행 때 이전 async 루프가 안 멈추고 좀비로 남아 desync).
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const clickAdd = async () => {
      // 추가 버튼은 블록이 늘면 아래로 밀리므로 매번 실제 위치를 측정
      const card = ref.current;
      const el = card?.querySelector<HTMLElement>("[data-add-interval]");
      if (card && el) setCursor(pointAt(el, card));
      await sleep(800);
      if (cancelled) return false;
      setClicking(true);
      await sleep(260);
      setClicking(false);
      return !cancelled;
    };

    (async () => {
      await sleep(500);
      while (!cancelled) {
        if (!(await clickAdd())) return;
        setItems([SONGS[0], SONGS[1], I1, SONGS[2]]); // 곡2 뒤에 인터미션
        setCaption("인터미션 블록을 끼웠어요");
        await sleep(1200);

        if (!(await clickAdd())) return;
        setItems([SONGS[0], SONGS[1], I1, SONGS[2], I2]); // 끝에 멘트
        setCaption("공연 순서 시트 완성 · 총 18분");
        await sleep(1600);

        // reset
        setItems(SONGS);
        setCaption("");
        await sleep(800);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, ref]);

  // 곡 번호: 카운터 재할당 없이 곡 id 목록의 인덱스로 계산 (rules-of-hooks immutability)
  const songIds = items.filter((i) => i.kind === "song").map((i) => i.id);

  return (
    <>
      <h2 className="text-h3 font-bold text-text mb-1 text-center">
        공연 순서 시트까지 한 번에
      </h2>
      <p className="text-sm text-text-muted text-center mb-5">
        곡 사이에 블록을 추가하여 공연 순서를 계획해요
      </p>

      <div
        ref={ref}
        className="relative rounded-2xl bg-surface border border-border p-4 shadow-lg shadow-black/30 max-w-md mx-auto"
      >
        <DemoCursor x={cursor.x} y={cursor.y} clicking={clicking} />

        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
          <span className="text-sm font-bold text-text">셋리스트</span>
          <span className="text-caption text-text-subtle">우리밴드 5월 공연</span>
        </div>

        <ul ref={listRef} className="space-y-2 min-h-[15rem]">
          {items.map((it) => {
            if (it.kind === "interval") {
              return (
                <li
                  key={it.id}
                  className="flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-warning/50 bg-warning/5"
                >
                  <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-warning">{it.title}</span>
                  <span className="text-caption text-warning/70">· {it.sub}</span>
                </li>
              );
            }
            const songNo = songIds.indexOf(it.id) + 1;
            return (
              <li key={it.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-hover/40">
                <span className="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center text-caption font-bold shrink-0">
                  {songNo}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{it.title}</div>
                  <div className="text-caption text-text-muted truncate">{it.sub}</div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="text-center my-2 h-5">
          <span className="text-caption font-medium text-primary">{caption}</span>
        </div>

        {/* add interval button (cursor target) */}
        <div data-add-interval className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-center text-sm text-text-subtle font-medium">
          + 인터벌 블록 추가
        </div>
      </div>
    </>
  );
}
