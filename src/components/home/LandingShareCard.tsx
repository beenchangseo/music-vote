import { ChevronIcon, KakaoIcon, TapIcon } from "@/components/ui/icons";
// 랜딩의 카톡 공유 장면. 멤버 쪽에서 보는 카드와 세 단계를 보여 준다.
// 카드 문구는 실제 공유 카드(KakaoShareButton 의 playlist 템플릿)와 같다.

export function LandingShareChat() {
  return (
    <div className="rounded-card bg-surface p-4">
      <p className="mb-3 text-center text-caption text-text-subtle">오후 9:41</p>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-tint text-sm font-bold text-text">
          지
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-caption text-text-muted">보컬 지민</span>
          <span className="self-start rounded-control rounded-tl-badge bg-surface-hover px-3 py-2 text-sm text-text">
            이번 주 일요일까지 투표해 줘!
          </span>
          <div className="w-62 max-w-full overflow-hidden rounded-card border border-border bg-surface-hover">
            <div className="relative h-31 overflow-hidden bg-primary-tint p-4">
              <span aria-hidden className="absolute -right-7 -top-10 size-35 rounded-pill bg-primary opacity-60" />
              <span aria-hidden className="absolute right-12 top-2.5 size-28 rounded-pill bg-primary-hover opacity-90" />
              <p className="relative text-caption font-bold text-text">Plypick</p>
              <p className="relative mt-7 text-h3 font-bold text-text">10월 정기 합주</p>
            </div>
            <div className="px-4 py-3">
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
    <ol aria-label="받은 멤버가 참여하는 순서" className="flex flex-col gap-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex items-center gap-3">
          <span className="w-3 text-sm font-bold tabular-nums text-text-muted">{i + 1}</span>
          <StepIcon icon={step.icon} />
          <h3 className="text-body font-bold text-text">{step.title}</h3>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ icon }: { icon: (typeof STEPS)[number]["icon"] }) {
  if (icon === "kakao") {
    return (
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-kakao text-kakao-text">
        <KakaoIcon className="size-5" />
      </span>
    );
  }
  if (icon === "vote") {
    return (
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-success-soft text-success">
        <ChevronIcon direction="up" className="size-5" />
      </span>
    );
  }
  return (
    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface-hover text-text">
      <TapIcon className="size-5" />
    </span>
  );
}
