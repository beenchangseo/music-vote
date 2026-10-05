"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Modal from "./ui/Modal";
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
  /** 후보곡 탭의 리스트/카드 보기 전환 버튼 (둥근 버튼 줄에 들어간다). */
  viewToggle?: ReactNode;
  /** ⋮ 시트의 "플레이리스트 설정". 방장에게만 넘긴다. */
  onOpenSettings?: () => void;
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
  viewToggle,
  onOpenSettings,
}: PlaylistHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
  // YouTube Music playlist header: one centered row of round buttons, the big play in the middle.
  const roundButton =
    "relative inline-flex h-12 w-12 items-center justify-center rounded-pill bg-surface-hover text-text transition-all hover:bg-surface-elevated active:scale-95";

  return (
    <header>
      {/* Top row: band path (members only, 5A) or back to home, account on the right. */}
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

      {/* Centered cover + title + one meta line. */}
      <div className="mt-2 flex flex-col items-center text-center">
        <RoomCover thumbs={coverThumbs} sizes="176px" className="h-44 w-44 shadow-xl shadow-black/40" />
        <h1 className="mt-5 line-clamp-2 break-keep text-h2 font-bold leading-tight text-text">{title}</h1>
        {meta && <div className="mt-1.5 w-full">{meta}</div>}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          onClick={handleKakaoShare}
          className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-kakao transition-all hover:bg-kakao-hover active:scale-95"
          aria-label="카카오톡 공유"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#3C1E1E" aria-hidden>
            <path d="M12 3C6.48 3 2 6.54 2 10.86c0 2.77 1.81 5.2 4.53 6.6-.2.73-.72 2.65-.83 3.06-.13.52.19.51.4.37.17-.11 2.63-1.78 3.7-2.51.7.1 1.42.16 2.2.16 5.52 0 10-3.54 10-7.86S17.52 3 12 3z" />
          </svg>
        </button>
        <AnnouncementButton playlistId={playlistId} announcement={announcement ?? null} shareCode={shareCode} />
        {onPlayAll && (
          <button
            type="button"
            onClick={onPlayAll}
            aria-label={playing ? "일시정지" : "전체 듣기"}
            className="inline-flex h-16 w-16 items-center justify-center rounded-pill bg-text text-bg shadow-lg shadow-black/40 transition-all hover:scale-105 active:scale-95"
          >
            {playing ? (
              <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
              </svg>
            )}
          </button>
        )}
        {viewToggle}
        <button type="button" onClick={() => setMenuOpen(true)} className={roundButton} aria-label="플레이리스트 메뉴">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>
      </div>

      {/* ⋮ sheet (Spotify / YouTube Music "more" sheet): what used to crowd the header. */}
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
        <div className="-mx-2 flex flex-col">
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings();
              }}
              className="flex min-h-12 items-center gap-3 rounded-control px-2 text-left text-body text-text transition-colors hover:bg-surface-hover"
            >
              <svg className="h-5 w-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              플레이리스트 설정
            </button>
          )}
          <Link
            href="/"
            className="flex min-h-12 items-center gap-3 rounded-control px-2 text-body text-text transition-colors hover:bg-surface-hover"
          >
            <svg className="h-5 w-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L12 3l9.75 9M4.5 10.5V21h5.25v-6h4.5v6H19.5V10.5" />
            </svg>
            홈으로
          </Link>
        </div>
      </Modal>
    </header>
  );
}
