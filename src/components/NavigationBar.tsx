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
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
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
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    ),
  },
  {
    id: "rehearsal",
    label: "합주",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
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
 * 플레이리스트 하단 탭 (음악 앱 탭 막대). 아이콘 위·이름 아래, 지금 탭은 아이콘 뒤 primary 알약.
 * 높이는 --spacing-dock(52px)에 맞춘다. MiniPlayer 가 bottom-dock 으로 이 위에 붙는다.
 */
export default function NavigationBar({ mode, onModeChange }: NavigationBarProps) {
  return (
    <nav
      aria-label="플레이리스트 화면"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-bg/95 backdrop-blur-md print:hidden"
    >
      <div className="mx-auto flex h-dock max-w-lg">
        {tabs.map((tab) => {
          const isActive = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onModeChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                isActive ? "text-text" : "text-text-muted hover:text-text"
              }`}
            >
              <span
                className={`inline-flex h-7 w-14 items-center justify-center rounded-pill transition-colors ${
                  isActive ? "bg-primary/20 text-primary" : ""
                }`}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
