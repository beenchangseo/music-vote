"use client";

import type { ReactNode } from "react";
import { useDialog } from "../ui/DialogProvider";
import RoundButton from "../ui/RoundButton";
import { EditIcon, ShareIcon } from "../ui/icons";
import { RoomCover } from "../band/BandArt";
import PlaylistActionRow, { type PlaylistMenuItem } from "./PlaylistActionRow";
import { track } from "@/lib/analytics";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-size";
import { roomSharePrefix } from "@/domain/team";
import { playlistShareCard, type InviteSongs } from "@/domain/invite-card";
import { kakaoShareQuery } from "@/domain/kakao-share";

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
  title: string;
  /** 투표 초대 카드에 싣는 곡. 올라온 순서다. */
  inviteSongs: InviteSongs;
  /** 보관된 플레이리스트(ADR 0012). 곡 없는 #11 이전 카드를 보낸다. */
  archived?: boolean;
  shareCode: string;
  participantCount?: number;
  /** Next show date of the room's band (public value, R10 payload table). Prefixes the card (25A). */
  showDate?: string | null;
  /** 커버 모자이크 (Spotify 플레이리스트). 점수 높은 곡부터 최대 4개. */
  coverThumbs?: string[];
  /** 제목 아래 줄 (곡 수·참여 인원·마감, 내 참여). */
  meta?: ReactNode;
  /** 동작 줄 오른쪽의 공지 원판 (AnnouncementButton). */
  notice: ReactNode;
  /** ⋯ 시트의 줄 (리스트/카드 보기). */
  menu: readonly PlaylistMenuItem[];
  /** 1위 곡부터 차례로 듣기. 없으면 재생 원판을 그리지 않는다. */
  onPlayAll?: () => void;
  /** 지금 무언가 재생 중인지 (버튼 문구가 "일시정지"로 바뀐다). */
  playing?: boolean;
  /** 편집 글리프가 여는 "플레이리스트 설정". 방장에게만 넘긴다. */
  onOpenSettings?: () => void;
}

export default function PlaylistHeader({
  title,
  inviteSongs,
  archived = false,
  shareCode,
  participantCount = 0,
  showDate,
  coverThumbs = [],
  meta,
  notice,
  menu,
  onPlayAll,
  playing = false,
  onOpenSettings,
}: PlaylistHeaderProps) {
  const { showAlert } = useDialog();

  async function handleKakaoShare() {
    const url = `${window.location.origin}/playlist/${shareCode}?${kakaoShareQuery("playlist")}`;
    const card = playlistShareCard({ title, archived }, participantCount, inviteSongs);
    // "10월 16일 공연 · " only while the show is ahead; never a D-day number on a card (25A).
    const description = roomSharePrefix(showDate, new Date()) + card.description;

    try {
      if (window.Kakao?.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: `🎵 ${title}`,
            description,
            imageUrl: `${window.location.origin}/api/og?${card.query}`,
            imageWidth: OG_IMAGE_WIDTH,
            imageHeight: OG_IMAGE_HEIGHT,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [
            { title: "투표 참여하기", link: { mobileWebUrl: url, webUrl: url } },
          ],
        });
        track("kakao_shared", { variant: "playlist" });
        return;
      }
    } catch {
      // Kakao SDK failed — fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        showAlert("카카오톡 공유에 실패해 링크를 복사했어요");
      } catch {
        showAlert(`링크를 복사해주세요:\n${url}`);
      }
    }
  }

  return (
    <div>
      {/* Spotify album page: a large centred cover, then the title and meta lines from the left edge. */}
      <div className="mt-3 flex justify-center">
        <RoomCover thumbs={coverThumbs} sizes="220px" className="size-55" />
      </div>
      <h1 className="mt-5 line-clamp-2 break-keep text-h2 font-bold leading-tight text-text">{title}</h1>
      {meta}
      <div className="mt-2">
        <PlaylistActionRow
          title={title}
          share={
            // The grey glyph still sends the vote invite in one tap: the Kakao share is the core viral loop.
            <RoundButton tone="ghost" size="md" edge="start" onClick={handleKakaoShare} aria-label="카카오톡 공유" title="카카오톡으로 투표 초대">
              <ShareIcon />
            </RoundButton>
          }
          edit={
            onOpenSettings && (
              <RoundButton tone="ghost" size="md" onClick={onOpenSettings} aria-label="플레이리스트 설정">
                <EditIcon />
              </RoundButton>
            )
          }
          menu={menu}
          notice={notice}
          play={onPlayAll && { label: "전체 듣기", playing, onClick: onPlayAll }}
        />
      </div>
    </div>
  );
}
