import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "tonal" | "ghost" | "danger" | "kakao";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary",
  tonal:
    "bg-surface-hover hover:bg-surface-elevated text-text",
  ghost:
    "bg-transparent hover:bg-surface-hover text-text-muted",
  danger:
    "bg-danger hover:bg-danger-hover text-on-danger",
  /** 카카오 로그인·공유. 말풍선 표시가 글자 앞에 붙는다. 카카오 노랑은 이 변형으로만 칠한다. */
  kakao:
    "bg-kakao hover:bg-kakao-hover text-kakao-text",
};

export const BUTTON_VARIANTS = Object.keys(variantClasses) as Variant[];

/** Keeps a 44px tap area around a control drawn shorter than 44px. The parent must not clip it. */
export const touchTarget44 = "relative after:absolute after:inset-x-0 after:top-1/2 after:h-control-md after:-translate-y-1/2";

const sizeClasses: Record<Size, string> = {
  sm: `h-control-sm px-3 text-sm ${touchTarget44}`,
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
        <span aria-hidden className="inline-block size-4 rounded-pill border-2 border-current border-t-transparent animate-spin" />
      ) : variant === "kakao" ? (
        <KakaoMark />
      ) : null}
      {children}
    </button>
  );
});

export default Button;

function KakaoMark() {
  return (
    <svg aria-hidden className="size-4.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.86 5.24 4.66 6.6l-1.18 4.32c-.1.36.31.64.61.43L11.2 19.4c.26.02.53.04.8.04 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
    </svg>
  );
}
