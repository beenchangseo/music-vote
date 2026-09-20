import { ButtonHTMLAttributes, forwardRef } from "react";

type Tone = "default" | "danger" | "brand";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 아이콘만 있는 버튼은 읽어줄 이름이 없다. 반드시 붙인다. */
  "aria-label": string;
  tone?: Tone;
  /** 테두리 없이 아이콘만. 툴바 안쪽에서 쓴다. */
  bare?: boolean;
}

const toneClasses: Record<Tone, string> = {
  default: "bg-surface border-border hover:bg-surface-hover hover:border-border-strong text-text-muted hover:text-text",
  danger: "bg-surface border-border hover:bg-danger-soft hover:border-danger/60 text-text-muted hover:text-danger",
  brand: "bg-primary border-primary hover:bg-primary-hover text-white",
};

/**
 * 44px 고정 아이콘 버튼.
 *
 * 헤더·플레이어 독·툴바에서 `p-2` + `w-4` 같은 조합이 반복되며 32~40px 로
 * 흩어져 있었다(AGENTS.md 는 ≥44px 을 요구한다). 시각 크기는 아이콘이 정하고
 * 히트 영역은 여기서 고정한다.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tone = "default", bare = false, className = "", children, type = "button", ...rest },
  ref,
) {
  const base = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control transition-all active:scale-95 disabled:opacity-50";
  const skin = bare
    ? "border-transparent text-text-muted hover:bg-surface-hover hover:text-text"
    : `border ${toneClasses[tone]}`;

  return (
    <button ref={ref} type={type} className={`${base} ${skin} ${className}`} {...rest}>
      {children}
    </button>
  );
});

export default IconButton;
