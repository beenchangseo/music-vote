import { ChevronIcon, KakaoIcon, TapIcon } from "@/components/ui/icons";
import { INVITE_CARD_BUTTON, inviteSongs, playlistShareCard } from "@/domain/invite-card";
import { DEMO_SONGS } from "./landing-demo-songs";
// 랜딩의 카톡 공유 장면. 멤버 쪽에서 보는 카드와 세 단계를 보여 준다.
// 카드 글자는 플레이리스트 화면의 공유 버튼(PlaylistHeader)이 보내는 카드를 같은 함수로 만든다.

/** 위 투표 예시의 플레이리스트. 네 명이 이미 투표했다. */
export const LANDING_INVITE = {
  title: "10월 정기 합주",
  participants: 4,
  songs: inviteSongs(
    DEMO_SONGS.map((song, i) => ({ title: song.title, youtube_video_id: "", created_at: new Date(Date.UTC(2026, 9, 1, 12, i)).toISOString() })),
  ),
};

export function LandingShareChat() {
  const card = playlistShareCard({ title: LANDING_INVITE.title, archived: false }, LANDING_INVITE.participants, LANDING_INVITE.songs);
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
              <p className="relative mt-7 text-h3 font-bold text-text">{LANDING_INVITE.title}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-bold text-text">{card.title}</p>
              <p className="mt-0.5 break-keep text-caption text-text-muted">{card.description}</p>
            </div>
            <p className="flex min-h-11 items-center justify-center border-t border-border text-sm font-bold text-text">{INVITE_CARD_BUTTON}</p>
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
