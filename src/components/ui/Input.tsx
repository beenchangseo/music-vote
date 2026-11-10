import { InputHTMLAttributes, forwardRef } from "react";

/** Input·Textarea 가 같이 쓰는 칸 모양. 채움은 surface-hover, 경계는 border-input(3:1), 포커스는 보라 링. */
export function controlSkin(invalid: boolean) {
  return `w-full bg-surface-hover border text-text placeholder-text-subtle text-body
    focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed transition-colors
    ${invalid ? "border-danger-fg" : "border-border-input"}`;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** 둥근 알약 모양 (검색창). 왼쪽에 아이콘 자리를 비운다. */
  pill?: boolean;
  /** 두세 자리 숫자 칸(분·초·BPM). 좌우 여백을 줄이고 가운데 맞춤한다. 56px 폭에서도 "59" 와 숫자 화살표가 들어간다. */
  compact?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, pill = false, compact = false, className = "", ...rest },
  ref,
) {
  const shape = pill ? "rounded-pill pl-11 pr-4" : compact ? "rounded-control px-2 text-center tabular-nums" : "rounded-control px-4";
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-control-md ${shape} ${controlSkin(invalid)} ${className}`}
      {...rest}
    />
  );
});

export default Input;
