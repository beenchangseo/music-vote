import Card from "./ui/Card";
import { showDateParts, formatShowDate, showDdayLabel, type ShowDday } from "@/lib/team-domain";

type UpcomingDday = Extract<ShowDday, { state: "upcoming" | "today" }>;

/** 스크린리더용 한 줄: "공연 10월 16일 금요일, 12일 남음" (디자인 리뷰 23A). */
export function showDateSpokenLabel(dday: UpcomingDday): string {
  const parts = showDateParts(dday.date);
  const date = parts ? `${parts.month}월 ${parts.day}일 ${parts.weekday}요일` : dday.date;
  return `공연 ${date}, ${dday.state === "today" ? "오늘" : `${dday.days}일 남음`}`;
}

interface ShowDateTileProps {
  dday: UpcomingDday;
  /** 있으면 타일 전체가 날짜 시트를 여는 버튼이 된다 (밴드 홈, 22A). */
  onClick?: () => void;
  className?: string;
}

/**
 * 공연 날짜 타일 (20A). `Card` elevated, 월·요일 + 큰 일 + "공연 D-12" + 정확한 날짜.
 * 조각 글자는 읽지 않고 한 줄 라벨로 읽는다 (23A).
 */
export default function ShowDateTile({ dday, onClick, className = "" }: ShowDateTileProps) {
  const parts = showDateParts(dday.date);
  const spoken = showDateSpokenLabel(dday);

  const body = (
    <>
      <div aria-hidden className="flex w-14 shrink-0 flex-col items-center leading-tight">
        <span className="text-caption text-text-muted">
          {parts?.month}월 · {parts?.weekday}
        </span>
        <span className="text-h2 font-bold tabular-nums text-text">{parts?.day}</span>
      </div>
      <div aria-hidden className="min-w-0 text-left">
        <p className="text-h4 font-semibold tabular-nums text-text">{showDdayLabel(dday)}</p>
        <p className="text-sm text-text-muted">{formatShowDate(dday.date)}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <Card variant="elevated" padding="none" className={className}>
        <button
          type="button"
          onClick={onClick}
          aria-label={spoken}
          className="flex min-h-14 w-full items-center gap-4 rounded-card p-4 transition-colors hover:bg-surface-hover"
        >
          {body}
        </button>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className={`flex items-center gap-4 ${className}`}>
      <span className="sr-only">{spoken}</span>
      {body}
    </Card>
  );
}
