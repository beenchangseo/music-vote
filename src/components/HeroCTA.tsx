"use client";

import { useState } from "react";
import Link from "next/link";
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
      <p className="mt-3 text-center text-caption text-text-subtle">
        또는{" "}
        <Link
          href="/new"
          className="underline underline-offset-2 hover:text-text-muted transition-colors"
        >
          전체 화면에서 만들기
        </Link>
      </p>

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
