"use client";

import TabBar, { type TabBarItem } from "../ui/TabBar";
import { CandidatesIcon, HomeIcon, RehearsalIcon, SetlistIcon } from "../ui/icons";

export type ViewMode = "playlist" | "setlist" | "rehearsal";

/** 탭 이름은 CONTEXT.md 의 도메인 용어를 따른다. 홈은 화면을 바꾸지 않고 앱 홈으로 나간다. */
const tabs: TabBarItem<ViewMode>[] = [
  { href: "/", label: "홈", icon: HomeIcon },
  { id: "playlist", label: "후보곡", icon: CandidatesIcon },
  { id: "setlist", label: "셋리스트", icon: SetlistIcon },
  { id: "rehearsal", label: "합주", icon: RehearsalIcon },
];

interface NavigationBarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

/** 플레이리스트 하단 탭. MiniPlayer 가 bottom-dock 으로 이 위에 붙는다. */
export default function NavigationBar({ mode, onModeChange }: NavigationBarProps) {
  return <TabBar items={tabs} value={mode} onChange={onModeChange} aria-label="플레이리스트 화면" />;
}
