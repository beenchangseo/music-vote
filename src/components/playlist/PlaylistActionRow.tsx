"use client";

import { useState, type ReactNode } from "react";
import { ListRowButton } from "../ui/ListRow";
import Modal from "../ui/Modal";
import RoundButton from "../ui/RoundButton";
import { MoreIcon, PlayPauseIcon } from "../ui/icons";

export interface PlaylistMenuItem {
  label: string;
  /** ui/icons 의 아이콘을 size-5 text-text-muted 로 넘긴다. */
  icon: ReactNode;
  onSelect: () => void;
}

interface PlaylistActionRowProps {
  /** ⋯ 시트 제목. */
  title: string;
  /** 왼쪽 첫 글리프. RoundButton ghost md 에 edge="start" 라 위 제목과 같은 세로줄에 선다. */
  share: ReactNode;
  /** 공유 다음 칸. 글리프 버튼이거나, 편집할 수 없는 사람에게 남기는 안내 한 줄이다. */
  edit?: ReactNode;
  /** ⋯ 시트의 줄. 비면 ⋯ 를 그리지 않는다. 빈 시트는 막다른 길이다. */
  menu: readonly PlaylistMenuItem[];
  /** 오른쪽 첫 원판 (AnnouncementButton). */
  notice: ReactNode;
  /** 없으면 재생 원판을 그리지 않는다. */
  play?: { label: string; playing: boolean; onClick: () => void };
}

/**
 * 후보곡·셋리스트 머리 아래의 동작 줄 (Spotify 앨범 화면). 왼쪽은 맨 글리프(공유 → 편집 → ⋯),
 * 오른쪽은 공지와 재생 원판이다. 재생은 이 화면에 하나뿐인 채운 primary 다.
 */
export default function PlaylistActionRow({ title, share, edit, menu, notice, play }: PlaylistActionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 print:hidden">
      <div className="flex min-w-0 items-center">
        {share}
        {edit}
        {menu.length > 0 && (
          <RoundButton tone="ghost" size="md" onClick={() => setMenuOpen(true)} aria-label="플레이리스트 메뉴">
            <MoreIcon />
          </RoundButton>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {notice}
        {play && (
          <RoundButton tone="primary" size="lg" onClick={play.onClick} aria-label={play.playing ? "일시정지" : play.label}>
            <PlayPauseIcon playing={play.playing} />
          </RoundButton>
        )}
      </div>

      {menu.length > 0 && (
        <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
          {menu.map((item) => (
            <ListRowButton
              key={item.label}
              onClick={() => {
                setMenuOpen(false);
                item.onSelect();
              }}
              leading={item.icon}
            >
              <span className="text-body text-text">{item.label}</span>
            </ListRowButton>
          ))}
        </Modal>
      )}
    </div>
  );
}
