import { InputHTMLAttributes, forwardRef } from "react";

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
      className={`w-full h-11 ${pill ? "rounded-pill pl-11 pr-4" : "rounded-control px-4"} bg-surface border text-text placeholder-text-subtle text-sm
        focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all
        ${invalid ? "border-danger" : "border-border"}
        ${className}`}
      {...rest}
    />
  );
});

export default Input;
