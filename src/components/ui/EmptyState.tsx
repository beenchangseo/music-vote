import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** 버튼 하나. 같은 화면의 다른 버튼과 목적이 겹치면 두지 않는다. */
  action?: ReactNode;
  /** screen: 목록 전체가 빈 자리 (카드 + 아이콘 원). inline: 목록 일부나 시트 안의 한 줄. */
  size?: "screen" | "inline";
  className?: string;
}

export default function EmptyState({ icon, title, description, action, size = "screen", className = "" }: EmptyStateProps) {
  if (size === "inline") {
    return (
      <div className={`flex items-center gap-2 py-3 text-sm text-text-muted ${className}`}>
        {icon && <span className="shrink-0 text-text-subtle">{icon}</span>}
        <div className="min-w-0 flex-1">
          {title && <div className="text-text">{title}</div>}
          {description && <div>{description}</div>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className={`rounded-card bg-surface px-4 py-8 text-center ${className}`}>
      {icon && (
        <div aria-hidden className="mx-auto mb-3 flex size-13 items-center justify-center rounded-pill bg-surface-hover text-text-muted">
          {icon}
        </div>
      )}
      {title && <p className="text-h4 font-semibold text-text">{title}</p>}
      {description && <div className="mx-auto mt-1 max-w-xs text-sm text-text-muted">{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
