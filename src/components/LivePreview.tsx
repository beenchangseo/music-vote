// 첫 진입자가 "이게 어떤 도구인지" 가입 전에 보는 정적 데모 카드.
// 실제 데이터 X — 시각적 증거.

const SAMPLE = [
  { title: "낭만고양이", artist: "체리필터", score: 4 },
  { title: "예뻤어", artist: "DAY6", score: 3 },
  { title: "스물다섯, 스물하나", artist: "자우림", score: 2 },
];

export default function LivePreview() {
  return (
    <div className="w-full max-w-md mx-auto select-none">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-caption text-text-subtle uppercase tracking-wider font-semibold">
          이렇게 됩니다
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-2xl bg-surface border border-border p-4 shadow-lg shadow-black/30">
        {/* fake header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
          <div>
            <div className="text-h3 font-bold text-text">우리밴드 5월 공연</div>
            <div className="text-caption text-text-subtle mt-0.5">멤버 5명 · 마감 D-2</div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-success/10 text-success text-caption font-semibold">
            진행중
          </div>
        </div>

        {/* fake song list */}
        <ul className="space-y-2">
          {SAMPLE.map((s, i) => (
            <li
              key={s.title}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-hover/40"
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-caption font-bold shrink-0 ${
                  i === 0
                    ? "bg-primary/20 text-primary"
                    : "bg-surface-elevated text-text-subtle"
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{s.title}</div>
                <div className="text-caption text-text-muted truncate">{s.artist}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <svg
                  className="w-4 h-4 text-success"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M12 4l8 8h-5v8h-6v-8H4z" />
                </svg>
                <span className="text-sm font-semibold tabular-nums text-text">
                  {s.score}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
