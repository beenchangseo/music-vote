"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-size";
import { bandShareDescription, roomSharePrefix, shareableShowDate } from "@/lib/team-domain";

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

export type ShareVariant = "playlist" | "decided" | "setlist" | "band";

/**
 * Where the card links. Rooms pass `shareCode` (→ /playlist/{code}); the band card
 * passes `linkPath` (→ /join/{inviteCode}, R10).
 */
type ShareLink = { shareCode: string; linkPath?: never } | { linkPath: string; shareCode?: never };

type KakaoShareButtonProps = ShareLink & {
  variant: ShareVariant;
  title: string;
  /** Card description fallback (when variant doesn't have its own auto-description). */
  description?: string;
  /**
   * Next show date (YYYY-MM-DD) of the room's or the band's band. Only a date that is
   * today or later goes on the card, checked at click time (25A); never a D-day number.
   */
  showDate?: string | null;
  /** Band card only: member count. */
  members?: number;
  /** Band card only: the band owner's name, used when the owner is still alone (DR13). */
  ownerName?: string | null;
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
};

const variantContent = (
  v: ShareVariant,
  title: string,
  description: string | undefined,
  songs: number,
  participants: number,
  showDate: string | null,
  members: number,
  ownerName: string | null,
): { title: string; description: string; cta: string } => {
  const now = new Date();
  switch (v) {
    case "band":
      return {
        title: `🎸 ${title}`,
        description: description || bandShareDescription(showDate, members, now, ownerName),
        cta: "밴드 들어가기",
      };
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
        // A band room carries the show date in front (25A): "10월 16일 공연 · 3곡 등록 · …".
        description:
          roomSharePrefix(showDate, now) +
          (description ||
            (participants > 0
              ? `${songs}곡 등록 · ${participants}명 참여 중`
              : `${songs}곡 등록 · 카카오 로그인 한 번이면 투표 끝`)),
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
    | "members"
  > & { date?: string | null },
) => {
  const sp = new URLSearchParams({
    variant,
    title: params.title,
  });
  if (params.members != null) sp.set("members", String(params.members));
  if (params.date) sp.set("date", params.date);
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
    "bg-kakao hover:bg-kakao-hover text-kakao-text font-semibold",
  secondary:
    "bg-surface-hover hover:bg-border-strong text-text font-semibold border border-border",
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
  linkPath,
  variant,
  title,
  description,
  showDate = null,
  members = 0,
  ownerName = null,
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
    track("kakao_shared", { variant });
    const origin = window.location.origin;
    const url = linkPath
      ? `${origin}${linkPath}?utm_source=kakao&utm_medium=share&variant=${variant}`
      : `${origin}/playlist/${shareCode}?utm_source=kakao&utm_medium=share&utm_campaign=${shareCode}&variant=${variant}`;
    const ogUrl = buildOgUrl(origin, variant, {
      title,
      songs,
      participants,
      topSong,
      topArtist,
      topScore,
      setlistCount,
      ...(variant === "band" ? { members, date: shareableShowDate(showDate, new Date()) } : {}),
    });
    const c = variantContent(variant, title, description, songs, participants, showDate, members, ownerName);

    // Kakao Share path
    try {
      if (window.Kakao?.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: c.title,
            description: c.description,
            imageUrl: ogUrl,
            imageWidth: OG_IMAGE_WIDTH,
            imageHeight: OG_IMAGE_HEIGHT,
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
