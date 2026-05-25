"use client";

// 섹션3 — 투표곡을 바로 재생. 자동 다음곡 / 한 곡 반복 / 랜덤 재생.
// 커서가 컨트롤 바를 눌러 재생 → 다음곡 → 랜덤 → 한곡반복 순으로 시연.

import { useEffect, useState } from "react";
import { useInView, prefersReducedMotion, DemoCursor, pointAt } from "./demo-kit";

const SONGS = [
  { title: "낭만고양이", artist: "체리필터" },
  { title: "예뻤어", artist: "DAY6" },
  { title: "벚꽃 엔딩", artist: "버스커 버스커" },
];

function Equalizer({ active }: { active: boolean }) {
  if (!active) {
    return <span className="text-caption text-text-subtle">▷</span>;
  }
  return (
    <span className="flex items-end gap-0.5 h-4" aria-hidden>
      {[0, 0.2, 0.4].map((d) => (
        <span
          key={d}
          className="w-1 bg-primary rounded-full origin-bottom"
          style={{ height: "100%", animation: `eq 0.8s ease-in-out ${d}s infinite` }}
        />
      ))}
    </span>
  );
}

export default function DemoPlayback() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [playing, setPlaying] = useState<number | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const [caption, setCaption] = useState("재생 버튼을 눌러보세요");
  const [cursor, setCursor] = useState({ x: 52, y: 88 });
  const [clicking, setClicking] = useState(false);
  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    // 취소 플래그는 effect 실행마다 지역 변수로 격리 (공유 ref 를 리셋하면
    // StrictMode/HMR 재실행 때 이전 async 루프가 안 멈추고 좀비로 남아 desync).
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    // 컨트롤 버튼의 실제 위치를 측정해 커서를 올린 뒤 클릭
    const click = async (name: string) => {
      const card = ref.current;
      const el = card?.querySelector<HTMLElement>(`[data-ctrl="${name}"]`);
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
        if (!(await click("play"))) return;
        setPlaying(0);
        setCaption("재생 중");
        await sleep(1100);

        if (!(await click("next"))) return;
        setPlaying(1);
        setCaption("끝나면 다음 곡 자동 재생");
        await sleep(1100);

        if (!(await click("shuffle"))) return;
        setShuffle(true);
        setPlaying(2);
        setCaption("랜덤 재생");
        await sleep(1100);

        if (!(await click("repeat"))) return;
        setRepeatOne(true);
        setCaption("한 곡 반복");
        await sleep(1300);

        // reset
        setPlaying(null);
        setShuffle(false);
        setRepeatOne(false);
        setCaption("재생 버튼을 눌러보세요");
        await sleep(900);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, ref]);

  return (
    <>
      <h2 className="text-h3 font-bold text-text mb-1 text-center">
        같이 들어보고 정해요
      </h2>
      <p className="text-sm text-text-muted text-center mb-5">
        후보곡을 바로 재생 · 다음 곡 자동 · 한 곡 반복 · 랜덤까지
      </p>

      <div
        ref={ref}
        className="relative rounded-2xl bg-surface border border-border p-4 shadow-lg shadow-black/30 max-w-md mx-auto"
      >
        <DemoCursor x={cursor.x} y={cursor.y} clicking={clicking} />

        <ul className="space-y-2 mb-4">
          {SONGS.map((s, i) => {
            const isPlaying = playing === i;
            return (
              <li
                key={s.title}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                  isPlaying ? "bg-primary/10 ring-1 ring-primary/30" : "bg-surface-hover/40"
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
                  <Equalizer active={isPlaying} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isPlaying ? "text-primary" : "text-text"}`}>
                    {s.title}
                  </div>
                  <div className="text-caption text-text-muted truncate">{s.artist}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* caption */}
        <div className="text-center mb-2 h-5">
          <span className="text-caption font-medium text-primary">{caption}</span>
        </div>

        {/* control bar */}
        <div className="flex items-center justify-between px-2 py-2 rounded-xl bg-surface-hover/60 border border-border">
          <Ctrl name="shuffle" active={shuffle} label="랜덤">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </Ctrl>
          <Ctrl name="prev" label="이전">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 5.25v13.5m-7.5-13.5v13.5L3.75 12l7.5-6.75z" />
          </Ctrl>
          <span data-ctrl="play" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <Ctrl name="next" label="다음">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25v13.5m7.5-13.5v13.5L20.25 12l-7.5-6.75z" />
          </Ctrl>
          <Ctrl name="repeat" active={repeatOne} label="한곡">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3l3 3-3 3M3 11V9a3 3 0 013-3h13M8 21l-3-3 3-3M21 13v2a3 3 0 01-3 3H5" />
          </Ctrl>
        </div>
      </div>
    </>
  );
}

function Ctrl({
  children,
  active = false,
  label,
  name,
}: {
  children: React.ReactNode;
  active?: boolean;
  label: string;
  name: string;
}) {
  return (
    <span
      data-ctrl={name}
      className={`flex flex-col items-center gap-0.5 transition-colors ${active ? "text-primary" : "text-text-muted"}`}
      aria-hidden
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        {children}
      </svg>
      <span className="text-[9px] font-medium">{label}</span>
    </span>
  );
}
