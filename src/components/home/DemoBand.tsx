"use client";

// 섹션5 — 합주 탭 깊이를 랜딩에 노출.
// 곡마다 키·BPM·난이도·장르·메트로놈·코멘트가 한 곳에 묶여 있다는 걸 시연.
// "보컬이 몇 키 낮추자고 했더라" pain point 를 정확히 해소하는 기능 = 진짜 차별점.

import { useEffect, useState } from "react";
import { useInView, prefersReducedMotion, DemoCursor, pointAt } from "./demo-kit";

interface Chip {
  id: "key" | "bpm" | "diff" | "genre";
  label: string;
}

// 합주 탭 카드와 동일한 칩 순서·라벨 포맷
const CHIPS: Chip[] = [
  { id: "key", label: "C major" },
  { id: "bpm", label: "134 BPM" },
  { id: "diff", label: "★★★" },
  { id: "genre", label: "락" },
];

interface Comment {
  nick: string;
  text: string;
}

const COMMENT: Comment = {
  nick: "보컬",
  text: "이거 1키 낮춰서 가자. 후렴 라이브에서 안 올라가더라",
};

export default function DemoBand() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [visibleChips, setVisibleChips] = useState<Chip["id"][]>([]);
  const [metroOn, setMetroOn] = useState(false);
  const [commentOn, setCommentOn] = useState(false);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [clicking, setClicking] = useState(false);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const moveTo = (selector: string) => {
      const card = ref.current;
      const el = card?.querySelector<HTMLElement>(selector);
      if (card && el) setCursor(pointAt(el, card));
    };

    (async () => {
      // 시작: 깨끗한 상태
      setVisibleChips([]);
      setMetroOn(false);
      setCommentOn(false);
      setCaption("");
      await sleep(600);

      while (!cancelled) {
        // 1) 칩 순차 등장 (key → bpm → diff → genre)
        for (const c of CHIPS) {
          if (cancelled) return;
          setVisibleChips((prev) => [...prev, c.id]);
          await sleep(380);
        }
        setCaption("키 · BPM · 난이도 · 장르 한곳에");
        await sleep(900);
        if (cancelled) return;

        // 2) 메트로놈 클릭
        moveTo("[data-metro]");
        await sleep(700);
        if (cancelled) return;
        setClicking(true);
        await sleep(220);
        setClicking(false);
        setMetroOn(true);
        setCaption("탭하면 메트로놈 134 BPM 바로 재생");
        await sleep(1400);
        if (cancelled) return;

        // 3) 댓글 클릭
        moveTo("[data-comment]");
        await sleep(700);
        if (cancelled) return;
        setClicking(true);
        await sleep(220);
        setClicking(false);
        setCommentOn(true);
        setCaption("키 낮춤·코멘트가 곡에 그대로 붙어요");
        await sleep(2000);

        // 4) 리셋
        setVisibleChips([]);
        setMetroOn(false);
        setCommentOn(false);
        setCaption("");
        await sleep(1000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, ref]);

  return (
    <>
      <h2 className="text-h3 font-bold text-text mb-1 text-center">
        키·BPM·코멘트가 곡에 붙어요
      </h2>
      <p className="text-sm text-text-muted text-center mb-5">
        단톡방 채팅 거슬러 올라가지 않아요
      </p>

      <div
        ref={ref}
        className="relative rounded-2xl bg-surface border border-border p-4 shadow-lg shadow-black/30 max-w-md mx-auto"
      >
        <DemoCursor x={cursor.x} y={cursor.y} clicking={clicking} />

        {/* 곡 행 (RehearsalView 패턴과 동일) */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/60">
          <span className="text-caption text-text-subtle w-5 text-center shrink-0">1</span>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/30 to-purple-500/30 shrink-0 flex items-center justify-center">
            <svg className="w-4 h-4 text-text-subtle" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-text truncate">벚꽃 엔딩</div>
            <div className="text-caption text-text-muted truncate">버스커 버스커</div>
          </div>
        </div>

        {/* 메타 칩 */}
        <div className="mt-3 flex flex-wrap gap-1.5 min-h-[28px]">
          {CHIPS.map((c) => {
            const shown = visibleChips.includes(c.id);
            return (
              <span
                key={c.id}
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-caption font-medium border transition-all duration-300 ${
                  shown
                    ? "bg-surface-hover border-border text-text opacity-100 translate-y-0"
                    : "bg-transparent border-transparent text-transparent opacity-0 translate-y-1"
                }`}
              >
                {c.id === "diff" ? <span className="text-warning">{c.label}</span> : c.label}
              </span>
            );
          })}
        </div>

        {/* 메트로놈 행 */}
        <div className="mt-3">
          <span
            data-metro
            className={`inline-flex items-center gap-1.5 text-caption font-semibold transition-colors ${
              metroOn ? "text-primary" : "text-text-subtle"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 21l4-18h6l4 18M9 21h6M10 12l4-7" />
            </svg>
            메트로놈 134
            {metroOn && (
              <span className="flex items-end gap-0.5 h-3 ml-1" aria-hidden>
                {[0, 0.18, 0.36].map((d) => (
                  <span
                    key={d}
                    className="w-0.5 bg-primary rounded-full"
                    style={{ height: "100%", animation: `eq 0.7s ease-in-out ${d}s infinite` }}
                  />
                ))}
              </span>
            )}
          </span>
        </div>

        {/* 댓글 행 */}
        <div className="mt-3 pt-3 border-t border-border/60">
          <div
            data-comment
            className={`rounded-lg p-2.5 border transition-all duration-300 ${
              commentOn
                ? "bg-surface-hover/60 border-border opacity-100"
                : "bg-surface-hover/20 border-dashed border-border/60 opacity-70"
            }`}
          >
            {commentOn ? (
              <>
                <div className="text-caption font-semibold text-primary mb-0.5">{COMMENT.nick}</div>
                <div className="text-sm text-text leading-snug">{COMMENT.text}</div>
              </>
            ) : (
              <div className="text-caption text-text-subtle">+ 코멘트 남기기</div>
            )}
          </div>
        </div>

        {/* caption */}
        <div className="text-center mt-3 h-5">
          <span className="text-caption font-medium text-primary">{caption}</span>
        </div>
      </div>
    </>
  );
}
