"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Modal from "@/components/ui/Modal";
import NoticeCard from "@/components/ui/NoticeCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Switch from "@/components/ui/Switch";
import TabBar from "@/components/ui/TabBar";
import Textarea from "@/components/ui/Textarea";
import ListRow, {
  ListGroup,
  ListRowButton,
  ListRowIcon,
  ListRowLink,
  SongRow,
  SongRowTitleButton,
} from "@/components/ui/ListRow";
import { ActionTab, ActionTabBar } from "@/components/ui/ActionTab";
import IconButton from "@/components/ui/IconButton";
import Avatar from "@/components/ui/Avatar";
import GuitarIcon from "@/components/ui/GuitarIcon";
import { useDialog } from "@/components/ui/DialogProvider";
import { COLORS, type ScaleToken } from "@/components/ui/tokens";

const HOVER_PROPS = { bg: "backgroundColor", text: "color", border: "borderColor" } as const;

/** CSS cannot force :hover, so this applies the child's own `hover:` colors inline. */
export function HoverSample({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current?.firstElementChild;
    if (!(el instanceof HTMLElement)) return;
    for (const cls of el.className.split(/\s+/)) {
      const m = cls.match(/^hover:(bg|text|border)-([a-z-]+?)(?:\/(\d+))?$/);
      const hex = m && COLORS.get(m[2])?.hex;
      if (!m || !hex) continue;
      el.style[HOVER_PROPS[m[1] as keyof typeof HOVER_PROPS]] = m[3] ? `color-mix(in srgb, ${hex} ${m[3]}%, transparent)` : hex;
    }
  }, []);
  return (
    <span ref={ref} className="contents">
      {children}
    </span>
  );
}

export function MotionDemo({ durations }: { durations: readonly ScaleToken[] }) {
  const [moved, setMoved] = useState(false);
  return (
    <div>
      <Button variant="tonal" size="sm" onClick={() => setMoved((v) => !v)}>
        {moved ? "되돌리기" : "움직이기"}
      </Button>
      <ul className="mt-3 space-y-3">
        {durations.map((d) => (
          <li key={d.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-caption text-text-muted">
              {d.name} {d.value}
            </span>
            <span className="relative h-6 flex-1 rounded-pill bg-surface-hover">
              {/* The dot runs on a track one dot narrower, so left-full stops it flush with the end. */}
              <span className="absolute inset-y-0 left-0 right-6">
                <span
                  className={`absolute top-0 size-6 rounded-pill bg-primary transition-[left] ease-standard ${d.utility} ${moved ? "left-full" : "left-0"}`}
                />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DialogDemo() {
  const dialog = useDialog();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="tonal" size="sm" onClick={() => void dialog.showAlert("모든 투표를 초기화했어요.")}>
        알림
      </Button>
      <Button variant="tonal" size="sm" onClick={() => void dialog.showConfirm("투표한 멤버 닉네임이 모두에게 보이게 돼요.", "기명 투표로 바꿀까요?")}>
        확인
      </Button>
      <Button
        variant="tonal"
        size="sm"
        onClick={() => void dialog.showDanger("곡·투표·셋리스트가 모두 사라져요. 되돌릴 수 없어요.", "플레이리스트를 삭제할까요?")}
      >
        위험
      </Button>
    </div>
  );
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const [mode, setMode] = useState<"free" | "quota">("free");
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="tonal" size="sm" onClick={() => setOpen(true)}>
          시트 열기
        </Button>
        <Button variant="tonal" size="sm" onClick={() => setFooterOpen(true)}>
          아래 칸이 붙은 시트
        </Button>
      </div>
      <Modal
        open={footerOpen}
        onClose={() => setFooterOpen(false)}
        title="댓글 · 예뻤어"
        footer={
          <div className="flex items-end gap-2">
            <Textarea aria-label="댓글" className="flex-1" rows={2} placeholder="본문이 길어도 이 칸은 제자리에 있어요" />
            <Button onClick={() => setFooterOpen(false)}>작성</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i} className="rounded-control bg-surface-hover p-3 text-sm text-text-muted">
              {i + 1}번째 댓글. 목록만 스크롤돼요.
            </p>
          ))}
        </div>
      </Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="플레이리스트 설정" description="투표 방식은 플레이리스트마다 정해요">
        <div className="flex gap-2">
          <Chip selected={mode === "free"} onClick={() => setMode("free")}>
            자유 투표
          </Chip>
          <Chip selected={mode === "quota"} onClick={() => setMode("quota")}>
            투표권 할당
          </Chip>
        </div>
        <Button size="lg" fullWidth className="mt-6" onClick={() => setOpen(false)}>
          저장
        </Button>
      </Modal>
    </>
  );
}

export function SwitchDemo() {
  const [anonymous, setAnonymous] = useState(true);
  const [inBand, setInBand] = useState(false);
  return (
    <div className="rounded-card bg-surface px-4">
      <Switch label="익명 투표" description="누가 투표했는지 안 보여요." checked={anonymous} onCheckedChange={setAnonymous} />
      <Switch label="일코해제에 만들기" icon={<GuitarIcon className="size-4" />} checked={inBand} onCheckedChange={setInBand} />
      <Switch label="비활성" checked={false} onCheckedChange={() => {}} disabled />
    </div>
  );
}

export function SegmentedDemo() {
  const [mode, setMode] = useState<"free" | "allocated">("allocated");
  const [view, setView] = useState<"all" | "mine" | "setlist">("all");
  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="투표 방식"
        value={mode}
        onChange={setMode}
        options={[
          { value: "free", label: "자유 투표" },
          { value: "allocated", label: "투표권 할당" },
        ]}
      />
      <SegmentedControl
        aria-label="보기"
        value={view}
        onChange={setView}
        options={[
          { value: "all", label: "전체" },
          { value: "mine", label: "내 곡" },
          { value: "setlist", label: "셋리스트", disabled: true },
        ]}
      />
    </div>
  );
}

const DOCK = [
  { id: "playlist", label: "후보곡", icon: null },
  { id: "setlist", label: "셋리스트", icon: null },
  { id: "rehearsal", label: "합주", icon: null },
] as const;

export function TabBarDemo() {
  const [tab, setTab] = useState<(typeof DOCK)[number]["id"]>("playlist");
  return <TabBar aria-label="디자인 시스템 하단 탭 예시" items={DOCK} value={tab} onChange={setTab} />;
}

export function NoticeDemo() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <Button variant="tonal" size="sm" onClick={() => setOpen(true)}>
        안내 다시 보기
      </Button>
    );
  }
  return (
    <div className="space-y-3">
      <NoticeCard
        onDismiss={() => setOpen(false)}
        actions={
          <Button variant="tonal" size="sm">
            밴드 이름 정하고 만들기
          </Button>
        }
      >
        이 멤버 그대로 다음 공연도 해요? 밴드로 묶어두면 다음 플레이리스트는 버튼 한 번이에요
      </NoticeCard>
      <NoticeCard
        tone="success"
        icon={
          <svg className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        }
        title="밴드를 만들었어요"
        onDismiss={() => setOpen(false)}
        dismissLabel="닫기"
        actions={<Button variant="kakao">카톡으로 알리기</Button>}
      >
        일코해제 · 멤버 4명
      </NoticeCard>
    </div>
  );
}

export function ListGroupDemo() {
  const [anonymous, setAnonymous] = useState(true);
  return (
    <div className="rounded-card bg-surface p-4">
      <p className="text-caption font-semibold text-text-muted">시트 안 묶음 (surface 위 surface-hover)</p>
      <ListGroup className="mt-2">
        <Switch label="익명 투표" description="누가 투표했는지 안 보여요." checked={anonymous} onCheckedChange={setAnonymous} />
      </ListGroup>
      <ListGroup className="mt-2">
        {[
          ["창빈", "방장 · 3표 사용"],
          ["민지", "5표 모두 사용"],
          ["도윤", "아직 안 썼어요"],
        ].map(([name, meta]) => (
          <ListRow key={name} leading={<Avatar name={name} />} trailing={<span className="text-sm font-bold tabular-nums text-text">5표</span>}>
            <p className="truncate text-sm font-semibold text-text">{name}</p>
            <p className="text-caption text-text-muted">{meta}</p>
          </ListRow>
        ))}
      </ListGroup>
      <p className="mt-4 text-caption font-semibold text-text-muted">줄 전체가 눌리는 행 (ListRowButton, 합주 단계)</p>
      <div className="mt-2">
        {[
          ["1", "예뻤어", "4:44"],
          ["2", "벚꽃 엔딩", "4:56"],
        ].map(([number, title, length]) => (
          <ListRowButton
            key={title}
            leading={
              <span className="grid size-7 place-items-center rounded-pill border-2 border-border-strong text-caption font-semibold tabular-nums text-text-muted">
                {number}
              </span>
            }
            trailing={<span className="text-caption tabular-nums text-text-muted">{length}</span>}
          >
            <span className="block truncate text-sm font-medium text-text">{title}</span>
          </ListRowButton>
        ))}
      </div>
      <p className="mt-4 text-caption font-semibold text-text-muted">시트의 고르기 줄 (ListRowButton + ListRowIcon, 셋리 넣기·내보내기)</p>
      <p className="mt-1 text-caption text-text-subtle">아이콘 칸은 줄보다 한 단계 위예요. 줄이 hover 로 surface-hover 가 되면 칸은 surface-elevated 로 올라가서 녹지 않아요.</p>
      <div className="mt-2 flex flex-col">
        <ListRowButton leading={<ListRowIcon className="text-primary-fg"><GuitarIcon className="size-5" /></ListRowIcon>}>
          <span className="block text-body font-semibold text-text">자작곡</span>
          <span className="block text-caption text-text-muted">우리 곡 한 블록 · 기본 3:00</span>
        </ListRowButton>
        <ListRowButton disabled leading={<ListRowIcon className="text-text"><GuitarIcon className="size-5" /></ListRowIcon>}>
          <span className="block text-body font-semibold text-text">비활성</span>
          <span className="block text-caption text-text-muted">고를 것이 없으면 흐리게 두고 hover 하지 않아요</span>
        </ListRowButton>
      </div>
      <p className="mt-4 text-caption font-semibold text-text-muted">줄 전체가 링크인 행 (ListRowLink)</p>
      <div className="mt-2">
        <ListRowLink
          href="/design"
          leading={<Avatar name="합" />}
          trailing={<span className="text-caption tabular-nums text-text-muted">셋리스트 6곡</span>}
        >
          <span className="block truncate text-sm font-medium text-text">10월 정기 합주</span>
        </ListRowLink>
      </div>
    </div>
  );
}

export function SongRowActionsDemo() {
  const [open, setOpen] = useState(true);
  const [inSetlist, setInSetlist] = useState(false);
  return (
    <div className="mt-3 rounded-card bg-surface">
      <div className="px-2">
        <SongRow rank={1} topRank cover={<span className="absolute inset-0 bg-surface-hover" />} trailing={<span className="text-sm font-bold tabular-nums text-text">6</span>}>
          <SongRowTitleButton onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="design-song-actions">
            <span className="line-clamp-2 text-body font-semibold leading-snug text-text">예뻤어</span>
            <span className="text-caption text-text-muted">DAY6 · 눌러서 접고 펴기</span>
          </SongRowTitleButton>
        </SongRow>
      </div>
      {open && (
        <ActionTabBar id="design-song-actions">
          <ActionTab icon={<GuitarIcon />} onClick={() => undefined}>
            댓글 2
          </ActionTab>
          <ActionTab icon={<GuitarIcon />} onClick={() => undefined}>
            버전
          </ActionTab>
          <ActionTab icon={<GuitarIcon />} selected={inSetlist} onClick={() => setInSetlist((v) => !v)}>
            {inSetlist ? "셋리스트에 있음" : "셋리스트에 추가"}
          </ActionTab>
          <IconButton bare aria-label="예뻤어 더보기">
            <svg className="size-4.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </IconButton>
        </ActionTabBar>
      )}
    </div>
  );
}
