"use client";

import { KeyboardEvent, ReactNode, useRef } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

const segmentTrackClass = "flex gap-1 rounded-card bg-surface-hover p-1";

/**
 * Segment look, shared with the bottom TabBar so both read as the same control.
 * The tint alone is 1.13:1 on the dock track and 1.07:1 on this one, so the primary-fg border (5.4:1 and up) carries the selected state.
 * Every cell keeps a 1px border so selecting one does not move the others.
 */
export function segmentItemClass(selected: boolean) {
  return `flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
    selected ? "border-primary-fg bg-primary-tint text-on-primary-tint" : "border-transparent text-text-muted hover:text-text"
  }`;
}

const STEP: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * 한 화면 안에서 보기·방식 하나를 고른다 (자유 투표 / 투표권 할당). 라디오 묶음이라 화살표로 옮기면 바로 고른다.
 * 화면을 바꾸는 하단 탭은 TabBar 다.
 */
export default function SegmentedControl<T extends string>({ options, value, onChange, className = "", ...labelling }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((o) => o.value === value && !o.disabled);
  const tabStop = checkedIndex >= 0 ? checkedIndex : options.findIndex((o) => !o.disabled);

  function onKeyDown(e: KeyboardEvent, from: number) {
    const step = STEP[e.key];
    if (!step) return;
    e.preventDefault();
    for (let i = 1; i < options.length; i++) {
      const next = (from + step * i + options.length) % options.length;
      if (options[next].disabled) continue;
      onChange(options[next].value);
      refs.current[next]?.focus();
      return;
    }
  }

  return (
    <div role="radiogroup" className={`${segmentTrackClass} ${className}`} {...labelling}>
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={option.disabled}
            onClick={() => !checked && onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={segmentItemClass(checked)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
