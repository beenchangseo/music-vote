"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useDialog } from "./DialogProvider";
import { RoomCover } from "./BandArt";
import AnnouncementButton from "./AnnouncementButton";
import AuthMenu from "./AuthMenu";
import GuitarIcon from "./GuitarIcon";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-size";
import { roomSharePrefix, showDday, showDdayLabel } from "@/lib/team-domain";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

interface PlaylistHeaderProps {
  playlistId: string;
  title: string;
  songCount: number;
  shareCode: string;
  participantCount?: number;
  announcement?: string | null;
  currentUserNickname?: string;
  currentUserAvatarUrl?: string | null;
  /**
   * Band path line above the title (5A). Band members only: the link would otherwise
   * hand the band to anyone holding the room link.
   */
  band?: { id: string; name: string; nextShowAt: string | null } | null;
  /** Next show date of the room's band (public value, R10 payload table). Prefixes the card (25A). */
  showDate?: string | null;
  /** 커버 모자이크 (Spotify 플레이리스트). 점수 높은 곡부터 최대 4개. */
  coverThumbs?: string[];
  /** 제목 아래 한 줄 (참여 인원·내 닉네임·로그인). */
  meta?: ReactNode;
  /** 후보곡 탭에서만: 1위 곡부터 차례로 듣기. 없으면 버튼을 그리지 않는다. */
  onPlayAll?: () => void;
  /** 지금 무언가 재생 중인지 (버튼 문구가 "일시정지"로 바뀐다). */
  playing?: boolean;
}

export default function PlaylistHeader({
  playlistId,
  title,
  songCount,
  shareCode,
  participantCount = 0,
  announcement,
  currentUserNickname,
  currentUserAvatarUrl,
  band,
  showDate,
  coverThumbs = [],
  meta,
  onPlayAll,
  playing = false,
}: PlaylistHeaderProps) {
  const { showAlert } = useDialog();
  const bandDday = band ? showDdayLabel(showDday(band.nextShowAt, new Date())) : null;

  async function handleKakaoShare() {
    const url = `${window.location.origin}/playlist/${shareCode}?utm_source=kakao&utm_medium=share&utm_campaign=${shareCode}`;
    // "10월 16일 공연 · " only while the show is ahead; never a D-day number on a card (25A).
    const description = roomSharePrefix(showDate, new Date()) + (participantCount > 0
      ? `${songCount}곡 등록 · ${participantCount}명 참여 중`
      : `${songCount}곡 등록 | 밴드 곡 투표에 참여하세요!`);

    try {
      if (window.Kakao?.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: `🎵 ${title}`,
            description,
            imageUrl: `${window.location.origin}/api/og?title=${encodeURIComponent(title)}&songs=${songCount}&participants=${participantCount}`,
            imageWidth: OG_IMAGE_WIDTH,
            imageHeight: OG_IMAGE_HEIGHT,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [
            { title: "투표 참여하기", link: { mobileWebUrl: url, webUrl: url } },
          ],
        });
        return;
      }
    } catch {
      // Kakao SDK failed — fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        showAlert("카카오톡 공유에 실패해 링크를 복사했어요.");
      } catch {
        showAlert(`링크를 복사해주세요:\n${url}`);
      }
    }
  }

  const iconButton =
    "inline-flex h-11 w-11 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-surface-hover hover:text-text active:scale-95";

  return (
    <header>
      {/* Top row: band path on the left (members only, 5A), account on the right. */}
      <div className="flex min-h-11 items-center justify-between gap-3">
        {band ? (
          <Link
            href={`/band/${band.id}`}
            className="-ml-1 inline-flex min-h-11 min-w-0 items-center gap-1 text-caption text-text-muted transition-colors hover:text-text"
          >
            <span aria-hidden>‹</span>
            <GuitarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{band.name}</span>
            {bandDday && (
              <>
                <span className="text-text-subtle" aria-hidden>·</span>
                <span className="shrink-0 tabular-nums">{bandDday}</span>
              </>
            )}
          </Link>
        ) : (
          <Link href="/" aria-label="홈으로" className={`-ml-2.5 ${iconButton}`}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        {currentUserNickname && (
          <AuthMenu nickname={currentUserNickname} avatarUrl={currentUserAvatarUrl ?? null} embedded />
        )}
      </div>

      {/* Spotify playlist header: mosaic cover + title. */}
      <div className="mt-3 flex items-end gap-4">
        <RoomCover thumbs={coverThumbs} sizes="112px" className="h-28 w-28 shrink-0 shadow-xl shadow-black/40" />
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="text-caption font-semibold text-text-muted">플레이리스트</p>
          <h1 className="mt-0.5 line-clamp-2 break-keep text-h2 font-bold leading-tight text-text">{title}</h1>
        </div>
      </div>
      {meta && <div className="mt-3">{meta}</div>}

      {/* Action row: share and notice on the left, listening on the right. */}
      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={handleKakaoShare}
          className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-pill transition-transform active:scale-95"
          aria-label="카카오톡 공유"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-kakao">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="#3C1E1E" aria-hidden>
              <path d="M12 3C6.48 3 2 6.54 2 10.86c0 2.77 1.81 5.2 4.53 6.6-.2.73-.72 2.65-.83 3.06-.13.52.19.51.4.37.17-.11 2.63-1.78 3.7-2.51.7.1 1.42.16 2.2.16 5.52 0 10-3.54 10-7.86S17.52 3 12 3z" />
            </svg>
          </span>
        </button>
        <AnnouncementButton playlistId={playlistId} announcement={announcement ?? null} shareCode={shareCode} />
        {band && (
          <Link href="/" aria-label="홈으로" className={iconButton}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L12 3l9.75 9M4.5 10.5V21h5.25v-6h4.5v6H19.5V10.5" />
            </svg>
          </Link>
        )}
        <div className="flex-1" />
        {onPlayAll && (
          <button
            type="button"
            onClick={onPlayAll}
            className="inline-flex h-11 items-center gap-2 rounded-pill bg-primary pl-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover active:scale-95"
          >
            {playing ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
              </svg>
            )}
            {playing ? "일시정지" : "전체 듣기"}
          </button>
        )}
      </div>
    </header>
  );
}
