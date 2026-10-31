"use client";

import { ButtonHTMLAttributes, ReactNode, useId } from "react";
import { touchTarget44 } from "./Button";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type" | "role"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** With a label the whole row toggles (DR12). Without one, give `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

/** 켜고 끄기. 꺼진 트랙은 border-input 이라 표면 위에서 3:1 이 나온다. */
export default function Switch({ checked, onCheckedChange, label, description, icon, className = "", disabled, ...rest }: SwitchProps) {
  const id = useId();
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`${touchTarget44} inline-flex h-7 w-12 shrink-0 items-center rounded-pill p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-border-input"
      } ${label ? "" : `disabled:opacity-50 ${className}`}`}
      {...rest}
    >
      <span
        aria-hidden
        className={`size-6 rounded-pill bg-text shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );

  if (!label) return track;

  return (
    <label className={`flex min-h-row items-center gap-3 py-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}>
      {icon && <span className="shrink-0 text-text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span id={`${id}-label`} className="block text-sm font-semibold text-text">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className="block text-caption text-text-muted">
            {description}
          </span>
        )}
      </span>
      {track}
    </label>
  );
}
