"use client";

import { useState, useTransition } from "react";
import Toast from "./Toast";
import { useDialog } from "./DialogProvider";
import { updateAnnouncement } from "@/actions/playlist";

interface AnnouncementButtonProps {
  playlistId: string;
  announcement: string | null;
  isAdmin: boolean;
  adminToken: string | null;
  shareCode: string;
}

export default function AnnouncementButton({ playlistId, announcement, isAdmin, adminToken, shareCode }: AnnouncementButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [text, setText] = useState(announcement || "");
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleClick() {
    if (isAdmin) {
      setText(announcement || "");
      setShowModal(true);
    } else if (announcement) {
      setShowToast(true);
    } else {
      showAlert("등록된 공지사항이 없습니다.");
    }
  }

  function handleSave() {
    if (!adminToken || isPending) return;
    startTransition(async () => {
      try {
        await updateAnnouncement(playlistId, adminToken, text.trim(), shareCode);
        setShowModal(false);
      } catch {
        showAlert("공지사항 저장에 실패했습니다.");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`relative p-2.5 rounded-xl border transition-all active:scale-95 ${
          announcement
            ? "bg-surface hover:bg-surface-hover border-primary/30 text-primary"
            : "bg-surface hover:bg-surface-hover border-border text-gray-500"
        }`}
        aria-label="공지사항"
        title={isAdmin ? "공지사항 작성" : announcement ? "공지사항 보기" : "공지사항 없음"}
      >
        {/* Push pin icon */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 17v5" />
          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1h.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H8a1 1 0 0 1 1 1z" />
        </svg>
        {announcement && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-gray-950" />
        )}
      </button>

      {/* Toast for non-admin */}
      {showToast && announcement && (
        <Toast message={`📌 공지사항\n\n${announcement}`} onClose={() => setShowToast(false)} />
      )}

      {/* Modal for admin */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-900 border border-border rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-100 mb-3">📌 공지사항</h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="멤버들에게 전달할 공지사항을 작성하세요"
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-border text-gray-100 placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-500">{text.length}/500</span>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">취소</button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 transition-all"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
