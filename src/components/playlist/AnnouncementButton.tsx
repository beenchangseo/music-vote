"use client";

import { useState, useTransition } from "react";
import Button from "../ui/Button";
import { useDialog } from "../ui/DialogProvider";
import Modal from "../ui/Modal";
import RoundButton from "../ui/RoundButton";
import Textarea from "../ui/Textarea";
import { updateAnnouncementPublic } from "@/actions/playlist";

interface AnnouncementButtonProps {
  playlistId: string;
  announcement: string | null;
  shareCode: string;
}

export default function AnnouncementButton({ playlistId, announcement, shareCode }: AnnouncementButtonProps) {
  const [showModal, setShowModal] = useState(false);
  // A sheet closes on a tap outside it, so an unsaved edit stays as a draft until it is saved.
  // Without one the field shows the latest announcement. `base` is the announcement the edit started from.
  const [draft, setDraft] = useState<{ base: string | null; text: string } | null>(null);
  const text = draft?.text ?? announcement ?? "";
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function openSheet() {
    // Another member saved since this draft began: show theirs instead of hiding it under a stale draft.
    if (draft && draft.base !== announcement) setDraft(null);
    setShowModal(true);
  }

  function handleSave() {
    if (isPending) return;
    startTransition(async () => {
      try {
        await updateAnnouncementPublic(playlistId, text.trim(), shareCode);
        setDraft(null);
        setShowModal(false);
      } catch {
        showAlert("공지사항 저장에 실패했습니다.");
      }
    });
  }

  return (
    <>
      <RoundButton
        tone="tonal"
        size="lg"
        onClick={openSheet}
        aria-label="공지사항"
        title={announcement ? "공지사항 보기/수정" : "공지사항 작성"}
      >
        <svg
          className={announcement ? "text-primary-fg" : undefined}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 17v5" />
          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1h.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H8a1 1 0 0 1 1 1z" />
        </svg>
        {announcement && <span className="absolute right-0.5 top-0.5 size-3 rounded-pill border-2 border-bg bg-primary" />}
      </RoundButton>

      {/* Modal portals to body: RoundRow is a query container, and WebKit up to Safari 18.2 traps position: fixed inside one (WebKit bug 284945). */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="공지사항">
        {announcement && !text && (
          <p className="mb-3 whitespace-pre-wrap rounded-control bg-surface-hover/50 p-3 text-sm text-text-muted">{announcement}</p>
        )}
        <Textarea
          value={text}
          onChange={(e) => setDraft({ base: draft ? draft.base : announcement, text: e.target.value })}
          placeholder="멤버들에게 전달할 공지사항을 작성하세요"
          rows={4}
          maxLength={500}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-caption text-text-subtle">{text.length}/500</span>
          <Button onClick={handleSave} loading={isPending}>
            저장
          </Button>
        </div>
      </Modal>
    </>
  );
}
