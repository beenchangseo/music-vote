import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "kakao";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary hover:bg-primary-hover text-white disabled:bg-primary/50",
  secondary:
    "bg-surface-hover hover:bg-border-strong text-text border border-border",
  ghost:
    "bg-transparent hover:bg-surface-hover text-text-muted",
  danger:
    "bg-danger hover:bg-red-600 text-white",
  /** 카카오 로그인 버튼. 카카오 노랑 위 어두운 글자라 흰 글자 primary 보다 대비가 높다. */
  kakao:
    "bg-kakao hover:bg-kakao-hover text-kakao-text",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
  icon: "h-11 w-11 rounded-xl",
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
  return `inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`;
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
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
        />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
