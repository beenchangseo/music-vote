import Image from "next/image";
import { avatarInitial } from "@/lib/band-art";

/**
 * 밴드 홈 히어로 뒤 그림 (Spotify Blend 의 겹친 원). 모든 밴드가 같은 기존 토큰 색
 * (primary-soft 배경 + primary · primary-hover 원)을 쓴다 — 2026-10-05 바이올렛 안으로 정함.
 * 아래쪽은 bg 로 녹아서 그 위에 밴드 이름을 얹는다.
 */
export function BandArt({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-primary-soft to-transparent" />
      <div className="absolute -right-12 -top-8 h-52 w-52 rounded-pill bg-primary opacity-55" />
      <div className="absolute right-16 top-6 h-48 w-48 rounded-pill bg-primary-hover opacity-90 mix-blend-screen" />
      {/* The lower half darkens so the band name stays readable over the art. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-transparent via-bg/70 to-bg" />
    </div>
  );
}

function NoteIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/**
 * 합주방 커버. 썸네일 4개면 2×2 모자이크(Spotify 플레이리스트), 1~3개면 첫 곡, 없으면 primary 그라데이션 + 음표.
 * 유튜브 썸네일은 16:9 라 가운데를 정사각형으로 자른다.
 */
export function RoomCover({
  thumbs,
  sizes,
  className = "",
}: {
  thumbs: string[];
  /** 커버 한 변의 화면 크기 (next/image sizes). */
  sizes: string;
  className?: string;
}) {
  const frame = `relative overflow-hidden rounded-control bg-surface-elevated ${className}`;

  if (thumbs.length >= 4) {
    const half = `calc(${sizes} / 2)`;
    return (
      <div aria-hidden className={`${frame} grid grid-cols-2 grid-rows-2`}>
        {thumbs.slice(0, 4).map((src) => (
          <div key={src} className="relative">
            <Image src={src} alt="" fill sizes={half} className="object-cover" />
          </div>
        ))}
      </div>
    );
  }

  if (thumbs.length > 0) {
    return (
      <div aria-hidden className={frame}>
        <Image src={thumbs[0]} alt="" fill sizes={sizes} className="object-cover" />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={`${frame} flex items-center justify-center bg-gradient-to-br from-primary to-primary-soft text-white/80`}
    >
      <NoteIcon className="h-1/3 w-1/3" />
    </div>
  );
}

/** 곡 한 줄 앞의 정사각 썸네일. */
export function SongThumb({ src, className = "" }: { src: string | null; className?: string }) {
  return (
    <div aria-hidden className={`relative shrink-0 overflow-hidden rounded-control bg-surface-elevated ${className}`}>
      {src ? (
        <Image src={src} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-subtle">
          <NoteIcon className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}

/** 이름 첫 글자 원형 아바타. 계정 메뉴(AuthMenu)의 사진 없는 아바타와 같은 색이다. */
export function MemberAvatar({ name, className = "h-8 w-8 text-sm" }: { name: string; className?: string }) {
  return (
    // The tint sits on an opaque bg layer so stacked avatars do not show through each other.
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-bg font-semibold text-primary ${className}`}
    >
      <span className="absolute inset-0 bg-primary/20" />
      <span className="relative">{avatarInitial(name)}</span>
    </span>
  );
}
