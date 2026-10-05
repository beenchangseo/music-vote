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
}

export default function HeroCTA({ loggedIn, myTeams = [] }: HeroCTAProps) {
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
      <Button onClick={handleClick} size="lg" fullWidth>
        {loggedIn ? "지금 시작하기 →" : "카카오로 시작하기 →"}
      </Button>

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
