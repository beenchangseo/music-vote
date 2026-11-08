import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ComponentPropsWithRef, HTMLAttributes, ReactNode } from "react";

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

/**
 * 눌리는 줄의 좌우 여백. hover 바탕이 칠해져도 글자가 바탕 끝에 붙지 않는다. 줄과 같은 세로선에 서야 하는
 * 옆 줄(합주 인터벌)도 이 값을 쓴다.
 */
export const pressableRowInset = "px-2";

const pressableRow = `group/row ${rowLayout} ${pressableRowInset} w-full min-w-0 rounded-control text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`;

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
}: RowSlots & ComponentPropsWithRef<"button">) {
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

/**
 * 줄 앞 40px 아이콘 칸. 시트(surface) 위 한 단계(surface-hover)이고, 눌리는 줄이 hover 로 같은 색이 되면 한 단계 더
 * 올라가서 줄에 녹지 않는다. 아이콘 색은 className 의 text-* 로 준다.
 */
export function ListRowIcon({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={`flex size-10 items-center justify-center rounded-control bg-surface-hover transition-colors group-hover/row:bg-surface-elevated group-disabled/row:bg-surface-hover ${className}`}
    >
      {children}
    </span>
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

interface SongRowCells {
  /** 48px 정사각 자리. 안에 `<Image fill>` 이나 그 자리를 다 덮는 재생 버튼을 넣는다. */
  cover: ReactNode;
  rank?: number;
  topRank?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
}

interface SongRowProps extends SongRowCells, Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * 바탕을 칠하는 행. 내용은 열 가장자리에 그대로 두고 바탕만 양옆 8px 밖까지 편다 (Spotify 행).
   * hover 는 올렸을 때, open 은 펼친 행이라 늘 surface 로 칠한다. 부르는 쪽이 음수 margin 으로 바탕을 넓히지 않는다.
   */
  surface?: "hover" | "open";
  /** 바탕 안, 행 아래 칸 (펼친 행의 동작 줄). 바탕 폭 끝까지 닿는다. surface 와 같이 쓴다. */
  footer?: ReactNode;
}

/**
 * SongRow 가운데 칸을 누르는 제목 줄. 행을 펼치는 버튼이라 aria-expanded 를 단다.
 * 56px 이상이라 한 줄 제목도 누르기 쉽다. 버튼 안이라 칸에는 span 만 둔다.
 */
export function SongRowTitleButton({ type = "button", children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button type={type} className="flex min-h-row w-full min-w-0 flex-col justify-center text-left" {...rest}>
      {children}
    </button>
  );
}

const songRowLayout = "flex min-h-row-song items-center gap-2.5 max-[359px]:gap-2";
// The surface reaches 8px past the column on each side; px-2 puts the row's own content back on the column edge.
const songRowSurface = { frame: "-mx-2 rounded-card transition-colors", row: "px-2", hover: "hover:bg-surface", open: "bg-surface" };

function SongRowCellsView({ cover, rank, topRank = false, trailing, children }: SongRowCells) {
  return (
    <>
      {rank != null && <RankNumber rank={rank} top={topRank} />}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-control bg-surface-elevated has-focus-visible:ring-2 has-focus-visible:ring-focus-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-bg max-[359px]:size-10">
        {cover}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );
}

/**
 * 곡 한 줄 (Spotify 행, 72px). 카드 배경 없이 바탕 위에 놓는다. [순위][48px 커버][제목·메타][점수·투표].
 * 가운데 칸(children)은 부르는 쪽이 그린다. 펼치는 행이면 제목 줄이 버튼이 되고, surface·footer 로 바탕과 동작 줄을 단다.
 */
export function SongRow({ cover, rank, topRank, trailing, surface, footer, className = "", children, ...rest }: SongRowProps) {
  const cells = (
    <SongRowCellsView cover={cover} rank={rank} topRank={topRank} trailing={trailing}>
      {children}
    </SongRowCellsView>
  );
  if (!surface) {
    return (
      <div className={`${songRowLayout} ${className}`} {...rest}>
        {cells}
      </div>
    );
  }
  return (
    <div className={`${songRowSurface.frame} ${songRowSurface[surface]} ${className}`} {...rest}>
      <div className={`${songRowLayout} ${songRowSurface.row}`}>{cells}</div>
      {footer}
    </div>
  );
}

/** 줄 전체가 링크인 SongRow. 바탕은 surface="hover" 와 같고, 포커스 테두리도 그 바탕을 따른다. */
export function SongRowLink({ cover, rank, topRank, trailing, className = "", children, ...rest }: SongRowCells & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link className={`block ${songRowSurface.frame} ${songRowSurface.hover} ${className}`} {...rest}>
      <div className={`${songRowLayout} ${songRowSurface.row}`}>
        <SongRowCellsView cover={cover} rank={rank} topRank={topRank} trailing={trailing}>
          {children}
        </SongRowCellsView>
      </div>
    </Link>
  );
}
