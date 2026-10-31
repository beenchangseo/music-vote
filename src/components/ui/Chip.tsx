import { ButtonHTMLAttributes, forwardRef } from "react";
import { touchTarget44 } from "./Button";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * 필터·선택지 칩. 켜고 끄는 버튼이라 aria-pressed 로 상태를 말한다.
 * 보이는 높이는 36px, 누르는 영역은 44px 이다. 가로로 스크롤되는 줄에 넣을 때는 줄에 세로 여백(py-1)을 줘서
 * 누르는 영역이 잘리지 않게 한다.
 * 선택 상태는 색만이 아니라 테두리로도 말한다.
 */
const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className = "", children, type = "button", ...rest },
  ref,
) {
  const skin = selected
    ? "border-primary-fg bg-primary-tint text-on-primary-tint"
    : "border-transparent bg-surface-hover text-text-muted hover:text-text";

  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={`inline-flex h-control-sm shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${touchTarget44} ${skin} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Chip;
