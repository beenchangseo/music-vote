import { TextareaHTMLAttributes, forwardRef } from "react";
import { controlSkin } from "./Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, rows = 3, className = "", ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`block resize-none rounded-control px-4 py-3 leading-relaxed ${controlSkin(invalid)} ${className}`}
      {...rest}
    />
  );
});

export default Textarea;
