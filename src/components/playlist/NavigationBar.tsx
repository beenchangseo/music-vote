"use client";

import TabBar, { type TabBarItem } from "../ui/TabBar";

export type ViewMode = "playlist" | "setlist" | "rehearsal";

/**
 * 탭 이름은 CONTEXT.md 의 도메인 용어를 따른다.
 * 컬러 이모지는 다크 플랫 UI 위에서 해상도·채도·광원이 어긋나 붕 뜬다. 선 아이콘으로 둔다.
 */
const tabs: TabBarItem<ViewMode>[] = [
  {
    id: "playlist",
    label: "후보곡",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </svg>
    ),
  },
  {
    id: "setlist",
    label: "셋리스트",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    ),
  },
  {
    id: "rehearsal",
    label: "합주",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3v12" />
        <circle cx="9" cy="17" r="3" />
        <path d="M12 6l6-2v4l-6 2" />
      </svg>
    ),
  },
];

interface NavigationBarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

/** 플레이리스트 하단 탭. MiniPlayer 가 bottom-dock 으로 이 위에 붙는다. */
export default function NavigationBar({ mode, onModeChange }: NavigationBarProps) {
  return <TabBar items={tabs} value={mode} onChange={onModeChange} aria-label="플레이리스트 화면" />;
}
