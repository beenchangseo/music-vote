import { ButtonHTMLAttributes, forwardRef } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * 필터·메타·뱃지 공용 칩.
 *
 * FilterBar 안에 같은 모양이 네 가지 변형으로 인라인 복붙돼 있었다.
 * 선택 상태는 색만이 아니라 테두리로도 말한다 — 색으로만 구분하면 구조가 안 읽힌다.
 */
const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className = "", children, type = "button", ...rest },
  ref,
) {
  const skin = selected
    ? "border-primary bg-primary-tint text-on-primary-tint"
    : "border-border bg-surface-hover text-text-muted hover:text-text";

  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={`inline-flex h-control-md shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-3 text-caption font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${skin} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Chip;
