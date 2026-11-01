import { HTMLAttributes, ReactNode, forwardRef } from "react";

type Variant = "default" | "elevated" | "outline" | "selected";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: "none" | "sm" | "md" | "lg";
  /**
   * 카드 끝까지 닿는 아래 칸(펼친 코멘트 등). 위에 구분선이 그어지고, padding 은 위 내용에만 붙는다.
   * 음수 margin 으로 padding 을 지워서 끝까지 펴지 않는다.
   * 칸을 여닫는 카드는 닫힌 동안 undefined 가 아니라 null·false 를 넘긴다. 카드의 짜임은 이 prop 이 있는지로
   * 정해져서, 칸을 여닫아도 위 내용이 다시 마운트되지 않고 포커스와 입력 중인 값이 남는다.
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
  const hasFooter = footer !== undefined;
  return (
    <div
      ref={ref}
      className={`rounded-card ${variantClasses[variant]} ${hasFooter ? "" : paddingClasses[padding]} ${className}`}
      {...rest}
    >
      {hasFooter ? (
        <>
          <div className={paddingClasses[padding]}>{children}</div>
          {footer ? <div className="border-t border-border">{footer}</div> : null}
        </>
      ) : (
        children
      )}
    </div>
  );
});

export default Card;
