/** 밴드 홈 자리 표시 (디자인 리뷰 7A): 이름·날짜 타일·주 버튼 자리를 그대로 잡아 둔다. */
export default function BandLoading() {
  return (
    <main className="min-h-full bg-bg" aria-busy="true" aria-label="밴드를 불러오는 중">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex h-11 items-center justify-between pr-12 sm:pr-0">
          <div className="h-11 w-11" />
          <div className="h-11 w-11 rounded-control bg-surface animate-pulse-soft" />
        </div>
        <div className="mt-4 h-8 w-2/3 rounded-control bg-surface animate-pulse-soft" />
        <div className="mt-3 h-[88px] rounded-card bg-surface animate-pulse-soft" />
        <div className="mt-4 h-12 rounded-control bg-surface animate-pulse-soft" />
        <div className="mt-8 h-6 w-1/3 rounded-control bg-surface animate-pulse-soft" />
        <div className="mt-3 space-y-2">
          <div className="h-14 rounded-control bg-surface/60 animate-pulse-soft" />
          <div className="h-14 rounded-control bg-surface/60 animate-pulse-soft" />
        </div>
      </div>
    </main>
  );
}
