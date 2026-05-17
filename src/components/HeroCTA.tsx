"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CreatePlaylistForm from "@/components/CreatePlaylistForm";
import { triggerKakaoLogin } from "@/lib/kakao-login";

interface HeroCTAProps {
  loggedIn: boolean;
}

export default function HeroCTA({ loggedIn }: HeroCTAProps) {
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
        <CreatePlaylistForm />
      </Modal>
    </>
  );
}
