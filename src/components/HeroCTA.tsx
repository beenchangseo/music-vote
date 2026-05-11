"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CreatePlaylistForm from "@/components/CreatePlaylistForm";

export default function HeroCTA() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" fullWidth>
        지금 시작하기 →
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
