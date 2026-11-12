"use client";

import { useState, type ReactNode } from "react";
import { ListRowButton } from "../ui/ListRow";
import Modal from "../ui/Modal";
import { useDialog } from "../ui/DialogProvider";
import { RoomCover } from "../band/BandArt";
import AnnouncementButton from "./AnnouncementButton";
import PlayPauseIcon from "../ui/PlayPauseIcon";
import RoundButton, { RoundRow } from "../ui/RoundButton";
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
  playlistId: string;
  title: string;
  /** 투표 초대 카드에 싣는 곡. 올라온 순서다. */
  inviteSongs: InviteSongs;
  /** 보관된 플레이리스트(ADR 0012). 곡 없는 #11 이전 카드를 보낸다. */
  archived?: boolean;
  shareCode: string;
  participantCount?: number;
  announcement?: string | null;
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
  inviteSongs,
  archived = false,
  shareCode,
  participantCount = 0,
  announcement,
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
      {/* Centered cover + title + one meta line. */}
      <div className="mt-2 flex flex-col items-center text-center">
        <RoomCover thumbs={coverThumbs} sizes="176px" className="h-44 w-44" />
        <h1 className="mt-5 line-clamp-2 break-keep text-h2 font-bold leading-tight text-text">{title}</h1>
        {meta && <div className="mt-1.5 w-full">{meta}</div>}
      </div>

      {/* YouTube Music playlist header: one centered row of round buttons, the big play in the middle. */}
      <RoundRow className="mt-5">
        <RoundButton tone="kakao" size="lg" onClick={handleKakaoShare} aria-label="카카오톡 공유">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3C6.48 3 2 6.54 2 10.86c0 2.77 1.81 5.2 4.53 6.6-.2.73-.72 2.65-.83 3.06-.13.52.19.51.4.37.17-.11 2.63-1.78 3.7-2.51.7.1 1.42.16 2.2.16 5.52 0 10-3.54 10-7.86S17.52 3 12 3z" />
          </svg>
        </RoundButton>
        <AnnouncementButton playlistId={playlistId} announcement={announcement ?? null} shareCode={shareCode} />
        {onPlayAll && (
          <RoundButton tone="inverse" size="hero" onClick={onPlayAll} aria-label={playing ? "일시정지" : "전체 듣기"}>
            <PlayPauseIcon playing={playing} />
          </RoundButton>
        )}
        {viewToggle}
        {/* The sheet holds only the host's settings, and an empty sheet is a dead end. */}
        {onOpenSettings && (
          <RoundButton tone="tonal" size="lg" onClick={() => setMenuOpen(true)} aria-label="플레이리스트 메뉴">
            <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </RoundButton>
        )}
      </RoundRow>

      {/* ⋮ sheet (Spotify / YouTube Music "more" sheet): what used to crowd the header. */}
      {onOpenSettings && (
        <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
          <ListRowButton
            onClick={() => {
              setMenuOpen(false);
              onOpenSettings();
            }}
            leading={
              <svg className="size-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            }
          >
            <span className="text-body text-text">플레이리스트 설정</span>
          </ListRowButton>
        </Modal>
      )}
    </div>
  );
}
