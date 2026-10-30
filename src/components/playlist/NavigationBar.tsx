"use client";

export type ViewMode = "playlist" | "setlist" | "rehearsal";

/**
 * 탭 이름은 CONTEXT.md 의 도메인 용어를 따른다.
 * 컬러 이모지는 다크 플랫 UI 위에서 해상도·채도·광원이 어긋나 붕 뜬다. 선 아이콘으로 둔다.
 */
const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
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

/**
 * 플레이리스트 하단 탭. YouTube Music 의 세그먼트(어두운 알약 트랙 위 선택된 칸만 흰 알약) 모양이다.
 * 높이는 --spacing-dock(64px)에 맞춘다. MiniPlayer 가 bottom-dock 으로 이 위에 붙는다.
 */
export default function NavigationBar({ mode, onModeChange }: NavigationBarProps) {
  return (
    <nav
      aria-label="플레이리스트 화면"
      className="fixed inset-x-0 bottom-0 z-40 bg-bg/95 backdrop-blur-md print:hidden"
    >
      <div className="mx-auto flex h-dock max-w-lg items-center px-4">
        <div className="flex w-full rounded-pill bg-surface-hover p-1">
          {tabs.map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onModeChange(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-sm font-semibold transition-colors ${
                  isActive ? "bg-text text-bg shadow-sm" : "text-text hover:bg-surface-elevated/60"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
