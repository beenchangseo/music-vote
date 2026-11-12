import type { HTMLAttributes, ReactNode } from "react";
import { InfoIcon, WarningIcon } from "./icons";

type Tone = "info" | "warning";

interface InlineNoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  /** 아래 줄에 붙는 링크나 버튼 하나. 누르는 높이 44px 은 여기서 준다. */
  action?: ReactNode;
}

const icons: Record<Tone, ReactNode> = {
  info: (
    <InfoIcon className="mt-0.5 size-4.5 shrink-0 text-primary-fg" />
  ),
  warning: (
    <WarningIcon className="mt-0.5 size-4.5 shrink-0 text-warning" />
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
