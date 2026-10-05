"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CreatePlaylistForm from "@/components/CreatePlaylistForm";
import { triggerKakaoLogin } from "@/lib/kakao-login";
import type { MyTeam } from "@/actions/team";

interface HeroCTAProps {
  loggedIn: boolean;
  /** 완료 화면의 "이 플레이리스트를 밴드에 넣을까요?" 후보 (디자인 리뷰 13A). */
  myTeams?: MyTeam[];
  /** 로그인 홈: 큰 "지금 시작하기" 대신 "+ 새 플레이리스트" 알약 버튼. */
  compact?: boolean;
}

export default function HeroCTA({ loggedIn, myTeams = [], compact = false }: HeroCTAProps) {
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (!loggedIn) {
      triggerKakaoLogin("/new");
      return;
    }
    setOpen(true);
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex h-12 items-center gap-2 rounded-pill bg-primary pl-4 pr-6 text-base font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover active:scale-95"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          새 플레이리스트
        </button>
      ) : (
        <Button onClick={handleClick} size="lg" fullWidth>
          {loggedIn ? "지금 시작하기 →" : "카카오로 시작하기 →"}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="플레이리스트 만들기"
      >
        <CreatePlaylistForm myTeams={myTeams} />
      </Modal>
    </>
  );
}
