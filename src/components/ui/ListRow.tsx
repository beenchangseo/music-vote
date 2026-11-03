import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode } from "react";

interface RowSlots {
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}

const rowLayout = "flex min-h-row items-center gap-3 py-2";

function Slots({ as: Slot, leading, trailing, children }: RowSlots & { as: "div" | "span" }) {
  return (
    <>
      {leading && <Slot className="flex shrink-0 items-center">{leading}</Slot>}
      <Slot className="min-w-0 flex-1">{children}</Slot>
      {trailing && <Slot className="flex shrink-0 items-center gap-1">{trailing}</Slot>}
    </>
  );
}

/** 설정·멤버 한 줄 (56px). [앞: 아바타·아이콘][가운데: 제목·설명][뒤: 스위치·스테퍼·버튼]. */
export default function ListRow({ leading, trailing, className = "", children, ...rest }: RowSlots & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${rowLayout} ${className}`} {...rest}>
      <Slots as="div" leading={leading} trailing={trailing}>
        {children}
      </Slots>
    </div>
  );
}

const pressableRow = `${rowLayout} w-full rounded-control text-left transition-colors hover:bg-surface-hover`;

/**
 * 줄 전체가 눌리는 ListRow. 버튼 안에는 글자·span 만 둘 수 있어서 칸도 span 으로 그린다.
 * 그래서 칸에는 div·p 대신 span 을 넣고, 버튼이나 링크는 넣지 않는다.
 */
export function ListRowButton({
  leading,
  trailing,
  className = "",
  children,
  type = "button",
  ...rest
}: RowSlots & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`${pressableRow} ${className}`} {...rest}>
      <Slots as="span" leading={leading} trailing={trailing}>
        {children}
      </Slots>
    </button>
  );
}

/** 줄 전체가 링크인 ListRow. 모양과 칸 규칙은 ListRowButton 과 같다. */
export function ListRowLink({
  leading,
  trailing,
  className = "",
  children,
  ...rest
}: RowSlots & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link className={`${pressableRow} ${className}`} {...rest}>
      <Slots as="span" leading={leading} trailing={trailing}>
        {children}
      </Slots>
    </Link>
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
      <div className="relative size-12 shrink-0 overflow-hidden rounded-control bg-surface-elevated has-focus-visible:ring-2 has-focus-visible:ring-focus-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-bg max-[359px]:size-10">
        {cover}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
