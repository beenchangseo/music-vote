"use client";

import { useState } from "react";

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

export type ShareVariant = "playlist" | "decided" | "setlist";

interface KakaoShareButtonProps {
  shareCode: string;
  variant: ShareVariant;
  title: string;
  /** Card description fallback (when variant doesn't have its own auto-description). */
  description?: string;
  /** OG image params (forwarded to /api/og). */
  songs?: number;
  participants?: number;
  topSong?: string;
  topArtist?: string;
  topScore?: number;
  setlistCount?: number;
  /** UI */
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  visualStyle?: "primary" | "secondary" | "subtle";
  size?: "sm" | "md" | "lg";
}

const variantContent = (
  v: ShareVariant,
  title: string,
  description: string | undefined,
  songs: number,
  participants: number,
): { title: string; description: string; cta: string } => {
  switch (v) {
    case "decided":
      return {
        title: `🎉 다음 합주곡 결정 — ${title}`,
        description:
          description ||
          `${participants > 0 ? `${participants}명 투표 결과` : "투표 결과"} · ${songs}곡 후보 중 1위`,
        cta: "결과 보기",
      };
    case "setlist":
      return {
        title: `🎵 셋리스트 확정 — ${title}`,
        description:
          description || `${songs}곡 셋리스트가 확정됐어요`,
        cta: "셋리스트 보기",
      };
    case "playlist":
    default:
      return {
        title: `🎤 ${title}`,
        description:
          description ||
          (participants > 0
            ? `${songs}곡 등록 · ${participants}명 참여 중`
            : `${songs}곡 등록 · 카톡으로 받은 링크로 가입 없이 투표`),
        cta: "지금 투표하기",
      };
  }
};

const buildOgUrl = (
  origin: string,
  variant: ShareVariant,
  params: Pick<
    KakaoShareButtonProps,
    | "title"
    | "songs"
    | "participants"
    | "topSong"
    | "topArtist"
    | "topScore"
    | "setlistCount"
  >,
) => {
  const sp = new URLSearchParams({
    variant,
    title: params.title,
  });
  if (params.songs != null) sp.set("songs", String(params.songs));
  if (params.participants != null)
    sp.set("participants", String(params.participants));
  if (params.topSong) sp.set("topSong", params.topSong);
  if (params.topArtist) sp.set("topArtist", params.topArtist);
  if (params.topScore != null) sp.set("topScore", String(params.topScore));
  if (params.setlistCount != null)
    sp.set("setlistCount", String(params.setlistCount));
  return `${origin}/api/og?${sp.toString()}`;
};

const styleMap: Record<NonNullable<KakaoShareButtonProps["visualStyle"]>, string> = {
  primary:
    "bg-[#FEE500] hover:bg-[#FFE000] text-[#191919] font-semibold",
  secondary:
    "bg-surface-hover hover:bg-gray-700 text-text font-semibold border border-border",
  subtle:
    "bg-transparent hover:bg-surface-hover text-text-muted hover:text-text font-medium",
};

const sizeMap: Record<NonNullable<KakaoShareButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
};

export default function KakaoShareButton({
  shareCode,
  variant,
  title,
  description,
  songs = 0,
  participants = 0,
  topSong,
  topArtist,
  topScore,
  setlistCount,
  children,
  className = "",
  ariaLabel,
  visualStyle = "primary",
  size = "md",
}: KakaoShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const origin = window.location.origin;
    const url = `${origin}/playlist/${shareCode}?utm_source=kakao&utm_medium=share&utm_campaign=${shareCode}&variant=${variant}`;
    const ogUrl = buildOgUrl(origin, variant, {
      title,
      songs,
      participants,
      topSong,
      topArtist,
      topScore,
      setlistCount,
    });
    const c = variantContent(variant, title, description, songs, participants);

    // Kakao Share path
    try {
      if (window.Kakao?.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: c.title,
            description: c.description,
            imageUrl: ogUrl,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [
            { title: c.cta, link: { mobileWebUrl: url, webUrl: url } },
          ],
        });
        return;
      }
    } catch {
      // fall through
    }

    // navigator.share fallback (in-app browsers, non-Kakao env)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: c.title, url });
        return;
      } catch {
        // user cancelled, fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("링크를 복사하세요:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel || "카카오톡으로 공유"}
      className={`inline-flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${styleMap[visualStyle]} ${sizeMap[size]} ${className}`}
    >
      {visualStyle === "primary" && <KakaoIcon />}
      {copied ? "링크 복사됨!" : children || "카카오톡으로 공유"}
    </button>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.86 5.24 4.66 6.6l-1.18 4.32c-.1.36.31.64.61.43L11.2 19.4c.26.02.53.04.8.04 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
    </svg>
  );
}
