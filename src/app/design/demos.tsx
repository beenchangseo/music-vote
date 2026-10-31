"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Modal from "@/components/ui/Modal";
import { useDialog } from "@/components/ui/DialogProvider";
import { COLORS, type ScaleToken } from "@/components/ui/tokens";

const HOVER_PROPS = { bg: "backgroundColor", text: "color", border: "borderColor" } as const;

/**
 * Paints its one child as if hovered. CSS cannot force :hover, so this reads the child's own
 * `hover:bg-*`/`hover:text-*`/`hover:border-*` classes and applies those colors inline. The sample
 * follows the primitive's classes instead of a second copy of them.
 */
export function HoverSample({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current?.firstElementChild;
    if (!(el instanceof HTMLElement)) return;
    for (const cls of el.className.split(/\s+/)) {
      const m = cls.match(/^hover:(bg|text|border)-([a-z-]+?)(?:\/(\d+))?$/);
      const hex = m && COLORS.get(m[2])?.hex;
      if (!m || !hex) continue;
      el.style[HOVER_PROPS[m[1] as keyof typeof HOVER_PROPS]] = m[3] ? `color-mix(in srgb, ${hex} ${m[3]}%, transparent)` : hex;
    }
  }, []);
  return (
    <span ref={ref} className="contents">
      {children}
    </span>
  );
}

export function MotionDemo({ durations }: { durations: readonly ScaleToken[] }) {
  const [moved, setMoved] = useState(false);
  return (
    <div>
      <Button variant="tonal" size="sm" onClick={() => setMoved((v) => !v)}>
        {moved ? "되돌리기" : "움직이기"}
      </Button>
      <ul className="mt-3 space-y-3">
        {durations.map((d) => (
          <li key={d.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-caption text-text-muted">
              {d.name} {d.value}
            </span>
            <span className="relative h-6 flex-1 rounded-pill bg-surface-hover">
              <span
                className={`absolute top-0 size-6 rounded-pill bg-primary transition-[left] ease-standard ${d.utility} ${moved ? "left-[calc(100%-1.5rem)]" : "left-0"}`}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DialogDemo() {
  const dialog = useDialog();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="tonal" size="sm" onClick={() => void dialog.showAlert("모든 투표를 초기화했어요.")}>
        알림
      </Button>
      <Button variant="tonal" size="sm" onClick={() => void dialog.showConfirm("투표한 멤버 닉네임이 모두에게 보이게 돼요.", "기명 투표로 바꿀까요?")}>
        확인
      </Button>
      <Button
        variant="tonal"
        size="sm"
        onClick={() => void dialog.showDanger("곡·투표·셋리스트가 모두 사라져요. 되돌릴 수 없어요.", "플레이리스트를 삭제할까요?")}
      >
        위험
      </Button>
    </div>
  );
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"free" | "quota">("free");
  return (
    <>
      <Button variant="tonal" size="sm" onClick={() => setOpen(true)}>
        시트 열기
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="플레이리스트 설정">
        <div className="flex gap-2">
          <Chip selected={mode === "free"} onClick={() => setMode("free")}>
            자유 투표
          </Chip>
          <Chip selected={mode === "quota"} onClick={() => setMode("quota")}>
            투표권 할당
          </Chip>
        </div>
        <Button size="lg" fullWidth className="mt-6" onClick={() => setOpen(false)}>
          저장
        </Button>
      </Modal>
    </>
  );
}
