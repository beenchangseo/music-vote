"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CreatePlaylistForm from "@/components/CreatePlaylistForm";
import CreateBandSheet, { type BandCandidate } from "@/components/CreateBandSheet";
import GuitarIcon from "@/components/GuitarIcon";
import { triggerKakaoLogin } from "@/lib/kakao-login";
import type { MyTeam } from "@/actions/team";

type HeroCTAProps =
  /** 로그아웃 랜딩: 카카오 로그인 뒤 홈으로 돌아온다(CEO2-A). 링크로 온 사람은 그 링크가 next 다. */
  | { variant: "landing" }
  | {
      /**
       * start = 상태 A (밴드 0 · 플레이리스트 0): 뜻이 붙은 두 선택지(DR2).
       * row = 상태 B: [＋ 새 플레이리스트][새 밴드] 버튼 줄(DR3).
       */
      variant: "start" | "row";
      /** 완료 화면의 "이 플레이리스트를 밴드에 넣을까요?" 후보 (디자인 리뷰 13A). */
      myTeams: MyTeam[];
      /** 새 밴드 시트의 "같이 투표한 멤버로 만들기" 목록 (DR3). */
      bandCandidates: BandCandidate[];
      /** 새 밴드 시트 맨 위 한 줄 (DR11). */
      participantOnlyTitle: string | null;
    };

/** 홈의 첫 버튼들. 플레이리스트 만들기 모달과 새 밴드 시트를 함께 든다. */
export default function HeroCTA(props: HeroCTAProps) {
  if (props.variant === "landing") {
    return (
      <Button variant="kakao" onClick={() => triggerKakaoLogin("/")} size="lg" fullWidth>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <path
            fill="currentColor"
            d="M10 3.2c-4.4 0-8 2.8-8 6.3 0 2.3 1.5 4.3 3.8 5.4l-.9 3.3c-.1.3.2.5.5.4l3.9-2.6c.2 0 .5 0 .7 0 4.4 0 8-2.8 8-6.3S14.4 3.2 10 3.2z"
          />
        </svg>
        카카오로 시작하기
      </Button>
    );
  }
  return <SignedInCTA {...props} />;
}

function SignedInCTA({
  variant,
  myTeams,
  bandCandidates,
  participantOnlyTitle,
}: Exclude<HeroCTAProps, { variant: "landing" }>) {
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [bandOpen, setBandOpen] = useState(false);

  return (
    <>
      {variant === "start" ? (
        <div className="space-y-3">
          <StartChoice
            onClick={() => setBandOpen(true)}
            label="밴드로 시작하기"
            hint="멤버를 한 번 모아 두면 공연마다 바로 투표해요"
            primary
          />
          <StartChoice
            onClick={() => setPlaylistOpen(true)}
            label="이번 합주곡만 정하기"
            hint="플레이리스트 링크를 단톡방에 보내요"
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaylistOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-primary pl-4 pr-6 text-base font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            새 플레이리스트
          </button>
          <button
            type="button"
            onClick={() => setBandOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-pill border border-border bg-surface-hover pl-4 pr-5 text-base font-semibold text-text transition-all hover:border-border-strong active:scale-95"
          >
            <GuitarIcon className="h-5 w-5" />
            새 밴드
          </button>
        </div>
      )}

      <Modal open={playlistOpen} onClose={() => setPlaylistOpen(false)} title="플레이리스트 만들기">
        <CreatePlaylistForm myTeams={myTeams} />
      </Modal>
      <CreateBandSheet
        open={bandOpen}
        onClose={() => setBandOpen(false)}
        mode="home"
        source="home"
        candidates={bandCandidates}
        participantOnlyTitle={participantOnlyTitle}
      />
    </>
  );
}

/** 상태 A 의 선택지 한 줄: 전체 너비 버튼 + 그 아래 뜻 한 줄 (DR2). */
function StartChoice({
  onClick,
  label,
  hint,
  primary = false,
}: {
  onClick: () => void;
  label: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <div>
      <Button onClick={onClick} size="lg" variant={primary ? "primary" : "secondary"} fullWidth>
        {label}
      </Button>
      <p className="mt-1.5 text-center text-caption text-text-muted">{hint}</p>
    </div>
  );
}
