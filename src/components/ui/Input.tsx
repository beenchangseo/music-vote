import { InputHTMLAttributes, forwardRef } from "react";

/** Input·Textarea 가 같이 쓰는 칸 모양. 채움은 surface-hover, 경계는 border-input(3:1), 포커스는 보라 링. */
export function controlSkin(invalid: boolean) {
  return `w-full bg-surface-hover border text-text placeholder-text-subtle text-body
    focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed transition-all
    ${invalid ? "border-danger-fg" : "border-border-input"}`;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** 둥근 알약 모양 (검색창). 왼쪽에 아이콘 자리를 비운다. */
  pill?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, pill = false, className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-control-md ${pill ? "rounded-pill pl-11 pr-4" : "rounded-control px-4"} ${controlSkin(invalid)} ${className}`}
      {...rest}
    />
  );
});

export default Input;
