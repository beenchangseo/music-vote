import { ReactElement, ReactNode, cloneElement, useId } from "react";

interface ControlProps {
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}

interface FieldProps {
  label: ReactNode;
  /** 칸 아래 한 줄. 오류가 있으면 오류가 이 자리를 대신한다. */
  help?: ReactNode;
  error?: ReactNode;
  /** Input 이나 Textarea 하나. id·invalid·aria-describedby 를 여기서 채운다. */
  children: ReactElement<ControlProps>;
  className?: string;
}

/** 라벨은 위, 도움말·오류는 아래. 칸과 글자를 이어서 화면 읽기 도구가 같이 읽게 한다. */
export default function Field({ label, help, error, children, className = "" }: FieldProps) {
  const fallbackId = useId();
  const id = children.props.id ?? fallbackId;
  const noteId = `${id}-note`;
  const note = error ?? help;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-text-muted">
        {label}
      </label>
      {cloneElement(children, {
        id,
        invalid: !!error || children.props.invalid,
        "aria-describedby": [note && noteId, children.props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
      })}
      {note && (
        <p id={noteId} className={`text-caption ${error ? "text-danger-fg" : "text-text-muted"}`}>
          {note}
        </p>
      )}
    </div>
  );
}
