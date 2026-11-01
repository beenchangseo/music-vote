"use client";

import { useState } from "react";
import Button from "../ui/Button";
import { track } from "@/lib/analytics";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-size";
import { bandShareDescription, roomSharePrefix } from "@/domain/team";
import type { CardImage } from "@/domain/share-card";

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
  /** Counts for the Kakao message text. */
  songs?: number;
  participants?: number;
  /** The card picture the server signed (src/lib/share-card.ts). The browser cannot make one (#35). */
  image: CardImage;
  /** UI */
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
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
  image,
  children,
  className = "",
  ariaLabel,
  size = "md",
}: KakaoShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    track("kakao_shared", { variant });
    const origin = window.location.origin;
    const url = linkPath
      ? `${origin}${linkPath}?utm_source=kakao&utm_medium=share&variant=${variant}`
      : `${origin}/playlist/${shareCode}?utm_source=kakao&utm_medium=share&utm_campaign=${shareCode}&variant=${variant}`;
    const c = variantContent(variant, title, description, songs, participants, showDate, members, ownerName);

    // Kakao Share path
    try {
      if (window.Kakao?.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: c.title,
            description: c.description,
            imageUrl: `${origin}${image}`,
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
    <Button type="button" variant="kakao" size={size} onClick={handleClick} aria-label={ariaLabel || "카카오톡으로 공유"} className={className}>
      {copied ? "링크 복사됨!" : children || "카카오톡으로 공유"}
    </Button>
  );
}
