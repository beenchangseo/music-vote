"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlaylist } from "@/actions/playlist";

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
  isAdmin: boolean;
  adminToken: string | null;
  participantCount?: number;
}

export default function PlaylistHeader({
  playlistId,
  title,
  songCount,
  shareCode,
  isAdmin,
  adminToken,
  participantCount = 0,
}: PlaylistHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleKakaoShare() {
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
      // Kakao SDK failed, fall through to generic share
    }
    handleShare();
  }

  async function handleShare() {
    const url = `${window.location.origin}/playlist/${shareCode}?utm_source=webshare&utm_medium=share&utm_campaign=${shareCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Plypick: ${title}`, url });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("링크를 복사하세요:", url);
    }
  }

  function handleDelete() {
    if (!adminToken || !confirm("정말 이 플레이리스트를 삭제하시겠습니까? 모든 곡과 투표가 삭제됩니다.")) return;

    startTransition(async () => {
      try {
        await deletePlaylist(playlistId, adminToken);
        // Remove from localStorage
        let myPlaylists = [];
        try { myPlaylists = JSON.parse(localStorage.getItem("myPlaylists") || "[]"); } catch { /* ignore */ }
        if (!Array.isArray(myPlaylists)) myPlaylists = [];
        const updated = myPlaylists.filter((p: { id: string }) => p.id !== playlistId);
        try { localStorage.setItem("myPlaylists", JSON.stringify(updated)); } catch { /* quota */ }
        router.push("/");
      } catch {
        alert("삭제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold truncate">{title}</h1>
        <p className="text-gray-400 text-sm mt-1">{songCount}곡</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* KakaoTalk share */}
        <button
          onClick={handleKakaoShare}
          className="p-2.5 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] border border-[#E5CC00] transition-all active:scale-95"
          aria-label="카카오톡 공유"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E">
            <path d="M12 3C6.48 3 2 6.54 2 10.86c0 2.77 1.81 5.2 4.53 6.6-.2.73-.72 2.65-.83 3.06-.13.52.19.51.4.37.17-.11 2.63-1.78 3.7-2.51.7.1 1.42.16 2.2.16 5.52 0 10-3.54 10-7.86S17.52 3 12 3z" />
          </svg>
        </button>
        {/* General share */}
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-all active:scale-95"
          aria-label="공유"
        >
          {copied ? (
            <svg className="w-5 h-5 text-upvote" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          )}
        </button>
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="p-2.5 rounded-xl bg-surface hover:bg-red-900/30 border border-border hover:border-red-800 transition-all active:scale-95 disabled:opacity-50"
            aria-label="삭제"
          >
            <svg className="w-5 h-5 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
