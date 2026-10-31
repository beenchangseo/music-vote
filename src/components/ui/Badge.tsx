import type { HTMLAttributes } from "react";

export type BadgeTone = "neutral" | "primary" | "warning";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-hover text-text-muted",
  primary: "bg-primary-tint text-on-primary-tint",
  warning: "bg-warning-tint text-warning",
};

export const BADGE_TONES = Object.keys(toneClasses) as BadgeTone[];

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** 20px 배지. 메타(BPM·키)는 neutral, 상태(셋리스트·개수)는 primary, 주의는 warning. 키마다 색을 따로 주지 않는다. */
export default function Badge({ tone = "neutral", className = "", children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center justify-center whitespace-nowrap rounded-badge px-1.5 text-caption font-semibold tabular-nums ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
