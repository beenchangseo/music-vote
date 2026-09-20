"use client";

import Link from "next/link";
import { useDialog } from "./DialogProvider";
import AnnouncementButton from "./AnnouncementButton";
import AuthMenu from "./AuthMenu";

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
}: PlaylistHeaderProps) {
  const { showAlert } = useDialog();

  async function handleKakaoShare() {
    const url = `${window.location.origin}/playlist/${shareCode}?utm_source=kakao&utm_medium=share&utm_campaign=${shareCode}`;
    const description = participantCount > 0
      ? `${songCount}곡 등록 · ${participantCount}명 참여 중`
      : `${songCount}곡 등록 | 밴드 곡 투표에 참여하세요!`;

    try {
      if (window.Kakao?.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: `🎵 ${title}`,
            description,
            imageUrl: `${window.location.origin}/api/og?title=${encodeURIComponent(title)}&songs=${songCount}&participants=${participantCount}`,
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

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {/* 곡 수는 아래 리스트 헤더에 이미 있다. 여기서는 빼서 한 줄로 둔다. */}
        <h1 className="text-h2 font-bold truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Home */}
        <Link
          href="/"
          aria-label="홈으로"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-surface hover:bg-surface-hover border border-border hover:border-border-strong text-text-muted hover:text-text transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L12 3l9.75 9M4.5 10.5V21h5.25v-6h4.5v6H19.5V10.5" />
          </svg>
        </Link>
        {/* KakaoTalk share */}
        <button
          onClick={handleKakaoShare}
          className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-[#FEE500] hover:bg-[#FDD800] border border-[#E5CC00] transition-all active:scale-95"
          aria-label="카카오톡 공유"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E">
            <path d="M12 3C6.48 3 2 6.54 2 10.86c0 2.77 1.81 5.2 4.53 6.6-.2.73-.72 2.65-.83 3.06-.13.52.19.51.4.37.17-.11 2.63-1.78 3.7-2.51.7.1 1.42.16 2.2.16 5.52 0 10-3.54 10-7.86S17.52 3 12 3z" />
          </svg>
        </button>
        {/* Announcement */}
        <AnnouncementButton
          playlistId={playlistId}
          announcement={announcement ?? null}
          shareCode={shareCode}
        />
        {currentUserNickname && (
          <AuthMenu
            nickname={currentUserNickname}
            avatarUrl={currentUserAvatarUrl ?? null}
            embedded
          />
        )}
      </div>
    </div>
  );
}
