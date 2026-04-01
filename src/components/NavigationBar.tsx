"use client";

export type ViewMode = "playlist" | "setlist" | "rehearsal";

interface NavigationBarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

const tabs: { id: ViewMode; label: string; icon: string }[] = [
  { id: "playlist", label: "플레이리스트", icon: "🎵" },
  { id: "setlist", label: "셋리스트", icon: "📋" },
  { id: "rehearsal", label: "합주", icon: "🎸" },
];

export default function NavigationBar({ mode, onModeChange }: NavigationBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 print:hidden">
      <div className="max-w-lg mx-auto px-4 py-2">
        <div className="flex bg-gray-800 rounded-full p-1">
          {tabs.map((tab) => {
            const isActive = mode === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onModeChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
