import { useId, type ReactNode } from "react";

/**
 * Plypick 이 직접 그린 아이콘 (#101 시안의 세트 a). 24 격자, 2px 둥근 선, 하단 탭 아이콘은 채운 짝이 있다.
 * Spotify 글리프를 따라 그리지 않는다. 그 자산을 베끼면 클론처럼 보인다.
 * 크기는 className 이 정하고 기본은 24px 다. RoundButton·TabBar 안에서는 부품이 정한 크기가 이긴다.
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

export function CandidatesIcon({ filled = false, className }: TabIconProps) {
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

export function RehearsalIcon({ filled = false, className }: TabIconProps) {
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

export function BackIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M15 4.5 7.5 12l7.5 7.5" />
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
