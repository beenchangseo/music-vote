"use client";

// 섹션2 — 투표하면 실시간으로 정렬되는 장면. 커서가 후보곡 위화살표를 눌러
// 점수가 오르고 순위가 재정렬된다.

import { useEffect, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useInView, prefersReducedMotion, DemoCursor, pointAt } from "./demo-kit";

interface Row {
  id: string;
  title: string;
  artist: string;
  score: number;
}

const BASE: Row[] = [
  { id: "a", title: "낭만고양이", artist: "체리필터", score: 3 },
  { id: "b", title: "예뻤어", artist: "DAY6", score: 2 },
  { id: "c", title: "스물다섯, 스물하나", artist: "자우림", score: 1 },
];
const RISER = "c"; // 이 곡이 투표받아 위로 올라감

export default function DemoVote() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [rows, setRows] = useState<Row[]>(BASE);
  const [cursor, setCursor] = useState({ x: 84, y: 72 });
  const [clicking, setClicking] = useState(false);
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 320, easing: "ease-in-out" });
  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    // 취소 플래그는 effect 실행마다 지역 변수로 격리 (공유 ref 를 리셋하면
    // StrictMode/HMR 재실행 때 이전 async 루프가 안 멈추고 좀비로 남아 desync).
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      await sleep(500);
      let votes = 0;
      while (!cancelled) {
        // RISER 곡의 실제 위쪽 화살표 위치를 측정해 커서 이동
        const card = ref.current;
        const upBtn = card?.querySelector<HTMLElement>(`[data-song-id="${RISER}"] [data-vote-up]`);
        if (card && upBtn) setCursor(pointAt(upBtn, card));
        await sleep(850);
        if (cancelled) return;

        setClicking(true);
        await sleep(280);
        if (cancelled) return;
        setClicking(false);
        // 클릭이 끝난 뒤 점수 반영 + 재정렬 → 행이 위로 올라감 (커서는 누른 자리에 머무름)
        setRows((prev) => {
          const next = prev.map((r) => (r.id === RISER ? { ...r, score: r.score + 1 } : r));
          next.sort((a, b) => b.score - a.score);
          return next;
        });

        votes += 1;
        await sleep(950);
        if (votes >= 3) {
          // 리셋
          await sleep(700);
          setRows(BASE.map((r) => ({ ...r })));
          votes = 0;
          await sleep(600);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, ref]);

  return (
    <>
      <h2 className="text-h3 font-bold text-text mb-1 text-center">
        투표하면 실시간으로 정렬돼요
      </h2>
      <p className="text-sm text-text-muted text-center mb-5">
        멤버가 누를 때마다 순위가 바로 바뀌어요
      </p>

      <div
        ref={ref}
        className="relative rounded-2xl bg-surface border border-border p-4 shadow-lg shadow-black/30 max-w-md mx-auto"
      >
        <DemoCursor x={cursor.x} y={cursor.y} clicking={clicking} />

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
          <div className="min-w-0">
            <div className="text-h3 font-bold text-text truncate">우리밴드 5월 공연</div>
            <div className="text-caption text-text-subtle mt-0.5">멤버 5명 · 마감 D-2</div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-success/10 text-success text-caption font-semibold shrink-0">
            진행중
          </div>
        </div>

        <ul ref={listRef} className="space-y-2">
          {rows.map((s) => {
            const voted = clicking && s.id === RISER;
            return (
              <li key={s.id} data-song-id={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-hover/40">
                <div className="w-9 h-9 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-text-subtle" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{s.title}</div>
                  <div className="text-caption text-text-muted truncate">{s.artist}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span data-vote-up className={`p-1 rounded-lg transition-colors ${voted ? "text-upvote bg-upvote/15" : "text-text-subtle"}`} aria-hidden>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </span>
                  <span className={`min-w-[1.5rem] text-center text-sm font-bold tabular-nums transition-colors ${voted ? "text-upvote" : "text-text"}`}>
                    {s.score}
                  </span>
                  <span className="p-1 rounded-lg text-text-subtle/50" aria-hidden>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
