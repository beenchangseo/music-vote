import type { HTMLAttributes, ReactNode } from "react";
import Card from "./Card";
import IconButton from "./IconButton";

export type NoticeTone = "primary" | "success" | "warning";

const toneIcon: Record<NoticeTone, string> = {
  primary: "text-primary-fg",
  success: "text-success",
  warning: "text-warning",
};

interface NoticeCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  tone?: NoticeTone;
  title?: ReactNode;
  actions?: ReactNode;
  /** 안내 카드는 늘 닫을 수 있다. 닫힘을 기억하는 일은 부르는 쪽이 한다. */
  onDismiss: () => void;
  dismissLabel?: string;
}

/**
 * 닫을 수 있는 안내 카드 (아이콘 + 제목 + 설명 + 동작 + ×). 상태가 이어지는 동안 남아야 하는 안내는 InlineNotice.
 */
export default function NoticeCard({
  icon,
  tone = "primary",
  title,
  actions,
  onDismiss,
  dismissLabel = "안내 닫기",
  className = "",
  children,
  ...rest
}: NoticeCardProps) {
  return (
    <Card className={className} {...rest}>
      <div className="flex items-start gap-3">
        {icon && (
          <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-pill bg-surface-hover ${toneIcon[tone]}`}>
            {icon}
          </span>
        )}
        <div className={`min-w-0 flex-1 ${icon ? "pt-1" : ""}`}>
          {title && <p className="text-sm font-semibold text-text">{title}</p>}
          {children && <div className={`text-sm leading-relaxed ${title ? "mt-0.5 text-text-muted" : "text-text"}`}>{children}</div>}
        </div>
        <IconButton bare aria-label={dismissLabel} onClick={onDismiss} className="-my-2 -mr-2">
          <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      </div>
      {/* Full card width: under the icon column two actions still fit one row at 360px. */}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
