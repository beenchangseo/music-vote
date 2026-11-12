"use client";

import TabBar, { type TabBarItem } from "../ui/TabBar";
import { HomeIcon, MetronomeIcon, SetlistIcon, SongIcon } from "../ui/icons";
import type { PlaylistLinkTab } from "@/domain/playlist-tab";

export type ViewMode = PlaylistLinkTab;

/** 플레이리스트의 세 탭. 이름은 CONTEXT.md 의 도메인 용어를 따른다. */
const PLAYLIST_TABS: TabBarItem<ViewMode>[] = [
  { id: "playlist", label: "후보곡", icon: SongIcon },
  { id: "setlist", label: "셋리스트", icon: SetlistIcon },
  { id: "rehearsal", label: "합주", icon: MetronomeIcon },
];

interface NavigationBarProps {
  /** 이 플레이리스트의 밴드. 볼 수 있는 사람(밴드 멤버)에게만 준다. 맨 위 줄의 밴드 이름과 같은 규칙이다. */
  band: { id: string } | null;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

/**
 * 플레이리스트 하단 탭. 맨 앞 칸은 이 화면을 떠난다. 볼 수 있는 밴드가 있으면 그 밴드 홈, 없으면 앱 홈이다.
 * MiniPlayer 가 이 탭이 알린 높이 위에 붙는다.
 */
export default function NavigationBar({ band, mode, onModeChange }: NavigationBarProps) {
  const home: TabBarItem<ViewMode> = band
    ? { href: `/band/${band.id}`, label: "밴드 홈", icon: HomeIcon }
    : { href: "/", label: "홈", icon: HomeIcon };
  return <TabBar items={[home, ...PLAYLIST_TABS]} value={mode} onChange={onModeChange} aria-label="플레이리스트 화면" />;
}
