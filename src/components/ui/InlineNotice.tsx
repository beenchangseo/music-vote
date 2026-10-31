import type { HTMLAttributes, ReactNode } from "react";

type Tone = "info" | "warning";

interface InlineNoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  /** 아래 줄에 붙는 링크나 버튼 하나. 누르는 높이 44px 은 여기서 준다. */
  action?: ReactNode;
}

const icons: Record<Tone, ReactNode> = {
  info: (
    <svg className="mt-0.5 size-4.5 shrink-0 text-primary-fg" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </svg>
  ),
  warning: (
    <svg className="mt-0.5 size-4.5 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  ),
};

/** 닫을 수 없는 상태 안내 한 줄 (보관된 플레이리스트, 마감 시각). 닫는 안내는 NoticeCard. */
export default function InlineNotice({ tone = "info", action, className = "", children, ...rest }: InlineNoticeProps) {
  return (
    <div className={`flex gap-2 text-sm leading-relaxed text-text-muted ${className}`} {...rest}>
      {icons[tone]}
      <div className="min-w-0 flex-1">
        {children}
        {action && <div className="mt-1 flex *:inline-flex *:min-h-11 *:items-center">{action}</div>}
      </div>
    </div>
  );
}
