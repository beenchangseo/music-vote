// 랜딩의 카톡 공유 장면. 멤버 쪽에서 보는 카드와 세 단계를 보여 준다.
// 카드 문구는 실제 공유 카드(KakaoShareButton 의 playlist 템플릿)와 같다.

export function LandingShareChat() {
  return (
    <div className="rounded-card bg-surface px-4 py-4.5">
      <p className="mb-3 text-center text-caption text-text-subtle">오후 9:41</p>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-sm font-extrabold text-text">
          지
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-caption text-text-muted">보컬 지민</span>
          <span className="self-start rounded-[4px_14px_14px_14px] bg-surface-hover px-3 py-2 text-sm text-text">
            이번 주 일요일까지 투표해 줘!
          </span>
          <div className="w-62 max-w-full overflow-hidden rounded-card border border-border bg-surface-hover">
            <div className="relative h-31 overflow-hidden bg-primary-soft p-3.5">
              <span aria-hidden className="absolute -right-7 -top-10 size-35 rounded-pill bg-primary opacity-60" />
              <span aria-hidden className="absolute right-12 top-2.5 size-28 rounded-pill bg-primary-hover opacity-90" />
              <p className="relative text-[11px] font-bold text-text">PLYPICK</p>
              <p className="relative mt-7 text-h3 font-black text-text">10월 정기 합주</p>
            </div>
            <div className="px-3.5 py-3">
              <p className="text-sm font-bold text-text">10월 정기 합주</p>
              <p className="mt-0.5 text-caption text-text-muted">5곡 등록 · 카카오 로그인 한 번이면 투표 끝</p>
            </div>
            <p className="flex min-h-11 items-center justify-center border-t border-border text-sm font-bold text-text">지금 투표하기</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "카드 누르기", icon: "tap" },
  { title: "카카오 로그인", icon: "kakao" },
  { title: "바로 투표", icon: "vote" },
] as const;

export function LandingShareSteps() {
  return (
    <ol aria-label="받은 멤버가 참여하는 순서" className="grid grid-cols-3 gap-2">
      {STEPS.map((step, i) => (
        <li key={step.title} className="rounded-card bg-surface px-2.5 py-3.5 text-center">
          <StepIcon icon={step.icon} />
          <p className="mt-2.5 text-caption font-bold text-text-muted">{i + 1}</p>
          <h3 className="mt-0.5 text-sm font-bold text-text">{step.title}</h3>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ icon }: { icon: (typeof STEPS)[number]["icon"] }) {
  if (icon === "kakao") {
    return (
      <span aria-hidden className="mx-auto flex size-11 items-center justify-center rounded-pill bg-kakao text-kakao-text">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path fill="currentColor" d="M10 3.2c-4.4 0-8 2.8-8 6.3 0 2.3 1.5 4.3 3.8 5.4l-.9 3.3c-.1.3.2.5.5.4l3.9-2.6c.2 0 .5 0 .7 0 4.4 0 8-2.8 8-6.3S14.4 3.2 10 3.2z" />
        </svg>
      </span>
    );
  }
  if (icon === "vote") {
    return (
      <span aria-hidden className="mx-auto flex size-11 items-center justify-center rounded-pill bg-success-soft text-success">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden className="mx-auto flex size-11 items-center justify-center rounded-pill bg-surface-hover text-text">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11V5a2 2 0 114 0v5" />
        <path d="M13 10a2 2 0 114 0v2" />
        <path d="M17 12a2 2 0 114 0v3a6 6 0 01-6 6h-2a7 7 0 01-5-2l-3.5-3.5a1.8 1.8 0 012.5-2.5L9 15" />
      </svg>
    </span>
  );
}
