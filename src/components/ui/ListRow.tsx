import type { HTMLAttributes, ReactNode } from "react";

interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
}

/** 설정·멤버 한 줄 (56px). [앞: 아바타·아이콘][가운데: 제목·설명][뒤: 스위치·스테퍼·버튼]. */
export default function ListRow({ leading, trailing, className = "", children, ...rest }: ListRowProps) {
  return (
    <div className={`flex min-h-row items-center gap-3 py-2 ${className}`} {...rest}>
      {leading && <div className="flex shrink-0 items-center">{leading}</div>}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  );
}

/** 시트 안에서 ListRow 들을 한 장으로 묶는다 (Toss 묶음 카드). 줄 사이에 구분선이 그어진다. */
export function ListGroup({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`divide-y divide-border rounded-card bg-surface-hover px-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** 순위 열. 폭이 고정이라 1위와 12위의 썸네일이 같은 자리에 선다. 상위만 보라로 칠한다. */
export function RankNumber({ rank, top = false }: { rank: number; top?: boolean }) {
  return (
    <span className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${top ? "text-primary-fg" : "text-text-subtle"}`}>{rank}</span>
  );
}

interface SongRowProps extends HTMLAttributes<HTMLDivElement> {
  /** 48px 정사각 자리. 안에 `<Image fill>` 이나 그 자리를 다 덮는 재생 버튼을 넣는다. */
  cover: ReactNode;
  rank?: number;
  topRank?: boolean;
  trailing?: ReactNode;
}

/**
 * 곡 한 줄 (Spotify 행, 72px). 카드 배경 없이 바탕 위에 놓는다. [순위][48px 커버][제목·메타][점수·투표].
 * 가운데 칸(children)은 부르는 쪽이 그린다. 펼치는 행이면 제목 줄이 버튼이 된다.
 */
export function SongRow({ cover, rank, topRank = false, trailing, className = "", children, ...rest }: SongRowProps) {
  return (
    <div className={`flex min-h-row-song items-center gap-2.5 max-[359px]:gap-2 ${className}`} {...rest}>
      {rank != null && <RankNumber rank={rank} top={topRank} />}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-control bg-surface-elevated max-[359px]:size-10">{cover}</div>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
