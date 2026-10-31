import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "tonal" | "ghost" | "danger" | "kakao";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

/** 채운 보라(primary)는 화면에 하나. 나란한 보조 동작은 tonal, 덜 중요한 동작은 ghost. */
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary disabled:bg-primary/50",
  tonal:
    "bg-surface-hover hover:bg-surface-elevated text-text",
  ghost:
    "bg-transparent hover:bg-surface-hover text-text-muted",
  danger:
    "bg-danger hover:bg-danger/90 text-on-danger",
  /** 카카오 로그인 버튼. 카카오 노랑 위 어두운 글자라 흰 글자 primary 보다 대비가 높다. */
  kakao:
    "bg-kakao hover:bg-kakao-hover text-kakao-text",
};

export const BUTTON_VARIANTS = Object.keys(variantClasses) as Variant[];

const sizeClasses: Record<Size, string> = {
  // 36px to see, 44px to touch: the ::after hit area reaches past the visible edge.
  sm: "relative h-control-sm px-3 text-sm after:absolute after:inset-x-0 after:top-1/2 after:h-control-md after:-translate-y-1/2",
  md: "h-control-md px-5 text-sm",
  lg: "h-control-lg px-6 text-body",
  icon: "size-control-md",
};

/**
 * Button 의 모양만. 버튼처럼 보여야 하는 `<Link>` 가 같은 클래스를 쓰게 한다
 * (not-found·안내 화면의 "홈으로" 처럼 이동이 목적인 곳).
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: { variant?: Variant; size?: Size; fullWidth?: boolean; className?: string } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        // currentColor, so the spinner reads on every variant (white on violet, dark on kakao yellow).
        <span aria-hidden className="inline-block size-4 rounded-pill border-2 border-current border-t-transparent animate-spin" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
