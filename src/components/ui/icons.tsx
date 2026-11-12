import { useId, type ReactNode } from "react";

/**
 * Plypick 이 직접 그린 아이콘 (#101 시안의 세트 a). 24 격자, 2px 둥근 선, 하단 탭 아이콘은 채운 짝이 있다.
 * Spotify 글리프를 따라 그리지 않는다. 그 자산을 베끼면 클론처럼 보인다.
 * 크기는 className 이 정하고 기본은 24px 다. RoundButton·TabBar 안에서는 부품이 정한 크기가 이긴다.
 * 앱의 아이콘은 모두 여기서 그린다. 뜻 하나에 그림 하나이고, 밖에서 <svg> 를 그리면 eslint(ds/no-inline-svg)가 막는다.
 */
export interface IconProps {
  className?: string;
}

/** 하단 탭 아이콘. 지금 화면의 탭이면 채운다. */
export interface TabIconProps extends IconProps {
  filled?: boolean;
}

function Glyph({ className = "size-6", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const HOUSE = "M4 10.4 12 4l8 6.4V19a2 2 0 0 1-2 2h-3.5v-5.5h-5V21H6a2 2 0 0 1-2-2z";
const SHEET =
  "M7.5 2h9A3.5 3.5 0 0 1 20 5.5v13a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 18.5v-13A3.5 3.5 0 0 1 7.5 2zM9 7a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2zm0 4a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2zm0 4a1 1 0 0 0 0 2h3.5a1 1 0 0 0 0-2z";
const METRONOME = "M9.6 3h4.8a1 1 0 0 1 .97.76L19.2 19.8A1 1 0 0 1 18.23 21H5.77a1 1 0 0 1-.97-1.2L8.63 3.76A1 1 0 0 1 9.6 3z";

export function HomeIcon({ filled = false, className }: TabIconProps) {
  return (
    <Glyph className={className}>
      <path fill={filled ? "currentColor" : undefined} d={HOUSE} />
    </Glyph>
  );
}

/** 곡. 후보곡 탭, 자작곡 블록, 썸네일 없는 커버. */
export function SongIcon({ filled = false, className }: TabIconProps) {
  return (
    <Glyph className={className}>
      <path d="M9 17.5V6l11-2.5V15" />
      {filled && <path fill="currentColor" d="M9 6l11-2.5V7L9 9.5z" />}
      <circle fill={filled ? "currentColor" : undefined} cx="6.5" cy="17.5" r="2.5" />
      <circle fill={filled ? "currentColor" : undefined} cx="17.5" cy="15" r="2.5" />
    </Glyph>
  );
}

export function SetlistIcon({ filled = false, className }: TabIconProps) {
  return (
    <Glyph className={className}>
      {filled ? (
        <path fill="currentColor" stroke="none" fillRule="evenodd" d={SHEET} />
      ) : (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.5" />
          <path d="M9 8h6M9 12h6M9 16h3.5" />
        </>
      )}
    </Glyph>
  );
}

/** 메트로놈. 합주 탭과 곡 정보의 메트로놈 링크. */
export function MetronomeIcon({ filled = false, className }: TabIconProps) {
  // The filled metronome cuts its base line and pendulum out of the body, so they read on any background.
  const mask = `metronome-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <Glyph className={className}>
      {filled ? (
        <>
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            <path d="M7.6 15.5h8.8M12 15.5 14.6 7" stroke="#000" />
          </mask>
          <path mask={`url(#${mask})`} fill="currentColor" stroke="none" d={METRONOME} />
        </>
      ) : (
        <>
          <path d={METRONOME} />
          <path d="M6.6 15.5h10.8" />
          <path d="M12 15.5 14.6 7" />
        </>
      )}
    </Glyph>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 14.5V3.5M7.5 8 12 3.5 16.5 8" />
      <path d="M8.5 11H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" />
    </Glyph>
  );
}

export function EditIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4.5 19.5l.8-3.9L15.9 5a2.1 2.1 0 0 1 3 0l.1.1a2.1 2.1 0 0 1 0 3L8.4 18.7z" />
      <path d="M13.8 7.1l3.1 3.1" />
    </Glyph>
  );
}

export function DoneIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Glyph>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="5" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function NoticeIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 10.2v3.6a1.5 1.5 0 0 0 1.5 1.5H7l8.5 4.7V4L7 8.7H5.5A1.5 1.5 0 0 0 4 10.2z" />
      <path d="M7.5 15.5 9 20" />
      <path d="M19 9.5a3.5 3.5 0 0 1 0 5" />
    </Glyph>
  );
}

/** 재생 ↔ 일시정지. 삼각형은 무게중심이 가운데라 원판 안에서 따로 옮기지 않는다. */
export function PlayPauseIcon({ playing, className }: IconProps & { playing: boolean }) {
  return (
    <Glyph className={className}>
      {playing ? (
        <>
          <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
          <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
        </>
      ) : (
        <path fill="currentColor" stroke="none" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" />
      )}
    </Glyph>
  );
}

export function CardsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="4.5" width="17" height="10" rx="2" />
      <path d="M3.5 19h17" />
    </Glyph>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Glyph>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 7h9M18 7h2M4 17h2M11 17h9" />
      <circle cx="15.5" cy="7" r="2.5" />
      <circle cx="8.5" cy="17" r="2.5" />
    </Glyph>
  );
}

export type Direction = "up" | "down" | "left" | "right";

const TURN: Record<Direction, number> = { right: 0, down: 90, left: 180, up: 270 };

/** 뒤로·다음 화면·펼치기·접기·찬성·반대가 같은 꺾쇠 하나를 돌려 쓴다. */
export function ChevronIcon({ direction, className }: IconProps & { direction: Direction }) {
  return (
    <Glyph className={className}>
      <path transform={`rotate(${TURN[direction]} 12 12)`} d="M8.25 4.5 15.75 12l-7.5 7.5" />
    </Glyph>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 19.5v-15M5.5 11 12 4.5l6.5 6.5" />
    </Glyph>
  );
}

/** circled 는 바탕 없는 자리(셋리스트 사이 넣기 줄)에서 누를 곳을 원으로 보인다. */
export function PlusIcon({ circled = false, className }: IconProps & { circled?: boolean }) {
  return (
    <Glyph className={className}>
      {circled ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8.5v7M8.5 12h7" />
        </>
      ) : (
        <path d="M12 5v14M5 12h14" />
      )}
    </Glyph>
  );
}

export function MinusIcon({ circled = false, className }: IconProps & { circled?: boolean }) {
  return (
    <Glyph className={className}>
      {circled ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12h7" />
        </>
      ) : (
        <path d="M5 12h14" />
      )}
    </Glyph>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Glyph>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </Glyph>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 6.5h16M9.5 6.5v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6 6.5l.9 12.15a2 2 0 0 0 2 1.85h6.2a2 2 0 0 0 2-1.85L18 6.5M10 11v5M14 11v5" />
    </Glyph>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
    </Glyph>
  );
}

export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10" />
    </Glyph>
  );
}

/** 앞뒤 곡 넘기기. 재생 삼각형과 같은 채운 모양이다. */
export function SkipIcon({ direction, className }: IconProps & { direction: "previous" | "next" }) {
  return (
    <Glyph className={className}>
      <g fill="currentColor" stroke="none" transform={direction === "previous" ? "matrix(-1 0 0 1 24 0)" : undefined}>
        <path d="M4.5 6.5v11a1 1 0 0 0 1.53.85l8.5-5.5a1 1 0 0 0 0-1.7l-8.5-5.5A1 1 0 0 0 4.5 6.5z" />
        <rect x="16.5" y="5" width="3" height="14" rx="1.2" />
      </g>
    </Glyph>
  );
}

export function ShuffleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M16 4h4v4M4 20 20 4M20 16v4h-4M14.5 14.5 20 20M4 4l5 5" />
    </Glyph>
  );
}

/** one 이면 고리 가운데에 1 을 적어 한 곡 반복을 보인다. */
export function RepeatIcon({ one = false, className }: IconProps & { one?: boolean }) {
  return (
    <Glyph className={className}>
      <path d="M17 1.5 20.5 5 17 8.5" />
      <path d="M3.5 11.5V9a4 4 0 0 1 4-4h13" />
      <path d="M7 22.5 3.5 19 7 15.5" />
      <path d="M20.5 12.5V15a4 4 0 0 1-4 4h-13" />
      {one && (
        <text x="12" y="12" dominantBaseline="central" textAnchor="middle" fontSize="9" fill="currentColor" stroke="none">
          1
        </text>
      )}
    </Glyph>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7.5A2.5 2.5 0 0 1 18 17h-6.5L7 20.5V17H6a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5z" />
    </Glyph>
  );
}

/** 같은 곡의 다른 영상(라이브·커버). */
export function VersionsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </Glyph>
  );
}

export function SetlistAddIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 6h12M4 12h12M4 18h7M18 15v6M15 18h6" />
    </Glyph>
  );
}

export function InSetlistIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 6h12M4 12h12M4 18h6M14 18l2.5 2.5L21 16" />
    </Glyph>
  );
}

/** 끌어서 순서를 바꾸는 손잡이. 세 줄은 ListIcon(리스트 보기)과 겹쳐 보여서 MoreIcon 과 같은 점 여섯 개로 그린다. */
export function DragHandleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="9" cy="5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="19" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="19" r="1.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Glyph>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Glyph>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </Glyph>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M10.27 4.4 2.9 17.5a2 2 0 0 0 1.73 3h14.74a2 2 0 0 0 1.73-3L13.73 4.4a2 2 0 0 0-3.46 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Glyph>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3" />
    </Glyph>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="15" cy="9.5" r="1.5" />
      <path d="m4 17.5 4.5-4.5 6 6M13 16l2-2 5 5" />
    </Glyph>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M13.5 3.5h-6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-10z" />
      <path d="M13.5 3.5v5h5M9 13h6M9 16.5h4" />
    </Glyph>
  );
}

export function QrCodeIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <path d="M14 14h.01M17 14h3M14 17v3M17 17v3h3" />
    </Glyph>
  );
}

/** 밴드에 멤버를 부른다. */
export function InviteIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M19 7.5v6M16 10.5h6" />
    </Glyph>
  );
}

/** 있던 플레이리스트를 밴드에 넣는다. */
export function FolderIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3.5 7a2 2 0 0 1 2-2h3.7l2.3 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </Glyph>
  );
}

/** 카드를 누른다(카톡 카드로 들어오는 순서). */
export function TapIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M9 11V5a2 2 0 1 1 4 0v5" />
      <path d="M13 10a2 2 0 1 1 4 0v2" />
      <path d="M17 12a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6h-2a7 7 0 0 1-5-2l-3.5-3.5a1.8 1.8 0 0 1 2.5-2.5L9 15" />
    </Glyph>
  );
}

/** 밴드. 밴드 화면·경로 줄·홈 "내 밴드"·초대 화면이 같이 쓴다. 🎸 이모지는 카톡 band 카드 제목에만 쓴다. */
export function GuitarIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M13.5 10.5 20 4" />
      <path d="m18.5 2.5 3 3" />
      <path d="M11.3 9.2c-1.4-1.1-3.4-1-4.6.3l-.4.4c-.6.6-1.5.9-2.3.9-1.4 0-2.5 1.6-1.6 3.6.6 1.4 1.7 2.9 3 4.2s2.8 2.4 4.2 3c2 .9 3.6-.2 3.6-1.6 0-.8.3-1.7.9-2.3l.4-.4c1.3-1.2 1.4-3.2.3-4.6" />
      <circle cx="9.5" cy="14.5" r="1.5" />
    </Glyph>
  );
}

/** 카카오 말풍선 심볼. 카카오가 정한 모양이라 우리 선으로 다시 그리지 않는다. */
export function KakaoIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        fill="currentColor"
        stroke="none"
        d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.86 5.24 4.66 6.6l-1.18 4.32c-.1.36.31.64.61.43L11.2 19.4c.26.02.53.04.8.04 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
      />
    </Glyph>
  );
}
