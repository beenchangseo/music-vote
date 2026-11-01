import { HTMLAttributes, ReactNode, forwardRef } from "react";

type Variant = "default" | "elevated" | "outline" | "selected";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: "none" | "sm" | "md" | "lg";
  /**
   * 카드 끝까지 닿는 아래 칸(펼친 코멘트 등). 위에 구분선이 그어지고, padding 은 위 내용에만 붙는다.
   * 음수 margin 으로 padding 을 지워서 끝까지 펴지 않는다.
   */
  footer?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-surface border border-border",
  elevated: "bg-surface-elevated border border-border-strong",
  outline: "bg-transparent border border-border",
  selected: "bg-surface border border-primary-fg",
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padding = "md", footer, className = "", children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-card ${variantClasses[variant]} ${footer ? "" : paddingClasses[padding]} ${className}`}
      {...rest}
    >
      {footer ? (
        <>
          <div className={paddingClasses[padding]}>{children}</div>
          <div className="border-t border-border">{footer}</div>
        </>
      ) : (
        children
      )}
    </div>
  );
});

export default Card;
