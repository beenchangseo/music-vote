import { HTMLAttributes, forwardRef } from "react";

type Variant = "default" | "elevated" | "outline";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses: Record<Variant, string> = {
  default: "bg-surface border border-border",
  elevated: "bg-surface-elevated border border-border-strong shadow-lg shadow-black/20",
  outline: "bg-transparent border border-border",
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padding = "md", className = "", children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
