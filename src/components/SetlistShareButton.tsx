"use client";

import { useState } from "react";
import Modal from "./ui/Modal";
import { useDialog } from "./DialogProvider";
import { track } from "@/lib/analytics";

interface Props {
  shareCode: string;
  title: string;
}

export default function SetlistShareButton({ shareCode, title }: Props) {
  const [open, setOpen] = useState(false);
  const { showAlert } = useDialog();

  async function shareLink() {
    const url = `${window.location.origin}/playlist/${shareCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} 셋리스트`, text: `${title} 셋리스트를 확인해보세요.`, url });
        setOpen(false);
      } else {
        await navigator.clipboard.writeText(url);
        setOpen(false);
        await showAlert("셋리스트 링크를 복사했어요.");
      }
      track("setlist_shared", { method: "link" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setOpen(false);
        await showAlert("셋리스트 링크를 복사했어요.");
        track("setlist_shared", { method: "link" });
      } catch {
        showAlert("링크 공유에 실패했습니다.");
      }
    }
  }

  function download(kind: "image" | "pdf") {
    const href = kind === "image"
      ? `/api/setlist-image/${shareCode}?download=1`
      : `/api/setlist-pdf/${shareCode}`;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = kind === "image" ? `${title}-셋리스트.png` : `${title}-셋리스트.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    track("setlist_exported", { format: kind });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-transparent text-text-muted transition-all hover:bg-surface-hover hover:text-text active:scale-95"
        aria-label="셋리스트 공유 및 저장"
        title="공유 및 저장"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 2.184-3.907 2.25 2.25 0 0 0-2.184 3.907Zm0-12.814a2.25 2.25 0 1 0 2.184 3.907 2.25 2.25 0 0 0-2.184-3.907Z" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="셋리스트 공유">
        <div className="space-y-2">
          <ShareOption
            title="링크 공유"
            description="단톡방이나 메시지로 셋리스트 링크를 보내요."
            icon={<LinkIcon />}
            onClick={shareLink}
          />
          <ShareOption
            title="이미지로 저장"
            description="휴대폰에서 보기 좋은 세로 이미지로 저장해요."
            icon={<ImageIcon />}
            onClick={() => download("image")}
          />
          <ShareOption
            title="PDF로 저장"
            description="전체 셋리스트를 여러 페이지 PDF로 저장해요."
            icon={<PdfIcon />}
            onClick={() => download("pdf")}
          />
        </div>
      </Modal>
    </>
  );
}

function ShareOption({ title, description, icon, onClick }: { title: string; description: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0"><strong className="block text-sm text-text">{title}</strong><span className="mt-0.5 block text-caption leading-relaxed text-text-muted">{description}</span></span>
    </button>
  );
}

function LinkIcon() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-3 3a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m4.242 4.5a4.5 4.5 0 0 1-1.242-7.244l3-3a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" /></svg>;
}

function ImageIcon() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm12.75-12h.008v.008H16.5V7.5Z" /></svg>;
}

function PdfIcon() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 12.75h7.5m-7.5 3h4.5M10.5 2.25H5.625A1.875 1.875 0 0 0 3.75 4.125v15.75a1.875 1.875 0 0 0 1.875 1.875h12.75a1.875 1.875 0 0 0 1.875-1.875V12a9.75 9.75 0 0 0-9.75-9.75Z" /></svg>;
}
