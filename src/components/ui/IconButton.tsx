import { ButtonHTMLAttributes, forwardRef } from "react";

type Tone = "default" | "danger" | "brand";
type Size = "md" | "sm";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 아이콘만 있는 버튼은 읽어줄 이름이 없다. 반드시 붙인다. */
  "aria-label": string;
  /** md 는 44px. sm 은 보이는 크기가 36px 이고 누르는 영역은 44×44 다. 36px 높이 줄(인터벌 카드) 안에 둔다. */
  size?: Size;
} & (
    | { bare?: false; tone?: Tone }
    | {
        /** 테두리 없이 아이콘만. 툴바·카드 안쪽에서 쓴다. danger 면 글리프가 빨강이다. */
        bare: true;
        tone?: Exclude<Tone, "brand">;
      }
  );

const toneClasses: Record<Tone, string> = {
  default: "bg-surface border-border hover:bg-surface-hover hover:border-border-strong text-text-muted hover:text-text",
  danger: "bg-surface border-border hover:bg-danger-soft hover:border-danger/60 text-text-muted hover:text-danger-fg",
  brand: "bg-primary border-primary hover:bg-primary-hover text-on-primary",
};

const bareToneClasses: Record<Exclude<Tone, "brand">, string> = {
  default: "text-text-muted hover:bg-surface-hover hover:text-text",
  danger: "text-danger-fg hover:bg-danger-soft",
};

const sizeClasses: Record<Size, string> = {
  md: "size-control-md",
  sm: "relative size-control-sm after:absolute after:left-1/2 after:top-1/2 after:size-control-md after:-translate-x-1/2 after:-translate-y-1/2",
};

/**
 * 고정 크기 아이콘 버튼.
 *
 * 헤더·플레이어 독·툴바에서 `p-2` + `w-4` 같은 조합이 반복되며 32~40px 로
 * 흩어져 있었다(AGENTS.md 는 ≥44px 을 요구한다). 시각 크기는 아이콘이 정하고
 * 히트 영역은 여기서 고정한다.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tone = "default", bare = false, size = "md", className = "", children, type = "button", ...rest },
  ref,
) {
  const base = "inline-flex shrink-0 items-center justify-center rounded-control transition-all active:scale-95 disabled:opacity-50";
  const skin = bare
    ? `border-transparent ${bareToneClasses[tone as Exclude<Tone, "brand">]}`
    : `border ${toneClasses[tone]}`;

  return (
    <button ref={ref} type={type} className={`${base} ${sizeClasses[size]} ${skin} ${className}`} {...rest}>
      {children}
    </button>
  );
});

export default IconButton;
