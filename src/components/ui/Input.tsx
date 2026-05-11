import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full h-11 px-4 rounded-xl bg-surface border text-text placeholder-text-subtle text-sm
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
