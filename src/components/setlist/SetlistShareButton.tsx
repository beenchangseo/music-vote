"use client";

import { useState } from "react";
import { ListRowButton, ListRowIcon } from "../ui/ListRow";
import Modal from "../ui/Modal";
import RoundButton from "../ui/RoundButton";
import { DocumentIcon, ImageIcon, LinkIcon, ShareIcon } from "../ui/icons";
import { useDialog } from "../ui/DialogProvider";
import { track } from "@/lib/analytics";
import { PLAYLIST_TAB_PARAM } from "@/domain/playlist-tab";

interface Props {
  shareCode: string;
  title: string;
}

export default function SetlistShareButton({ shareCode, title }: Props) {
  const [open, setOpen] = useState(false);
  const { showAlert } = useDialog();

  async function shareLink() {
    const url = `${window.location.origin}/playlist/${shareCode}?${PLAYLIST_TAB_PARAM}=setlist`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} 셋리스트`, text: `${title} 셋리스트를 확인해보세요.`, url });
        setOpen(false);
      } else {
        await navigator.clipboard.writeText(url);
        setOpen(false);
        await showAlert("셋리스트 링크를 복사했어요");
      }
      track("setlist_shared", { method: "link" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setOpen(false);
        await showAlert("셋리스트 링크를 복사했어요");
        track("setlist_shared", { method: "link" });
      } catch {
        showAlert("링크를 공유하지 못했어요");
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
      <RoundButton tone="ghost" size="md" edge="start" onClick={() => setOpen(true)} aria-label="셋리스트 내보내기" title="링크·이미지·PDF 로 내보내기">
        <ShareIcon />
      </RoundButton>

      <Modal open={open} onClose={() => setOpen(false)} title="셋리스트 내보내기">
        <div className="flex flex-col">
          <ShareOption
            title="링크 공유"
            description="단톡방이나 메시지로 셋리스트 링크를 보내요."
            icon={<LinkIcon className="size-5" />}
            onClick={shareLink}
          />
          <ShareOption
            title="이미지로 저장"
            description="휴대폰에서 보기 좋은 세로 이미지로 저장해요."
            icon={<ImageIcon className="size-5" />}
            onClick={() => download("image")}
          />
          <ShareOption
            title="PDF로 저장"
            description="전체 셋리스트를 여러 페이지 PDF로 저장해요."
            icon={<DocumentIcon className="size-5" />}
            onClick={() => download("pdf")}
          />
        </div>
      </Modal>
    </>
  );
}

function ShareOption({ title, description, icon, onClick }: { title: string; description: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <ListRowButton onClick={onClick} leading={<ListRowIcon className="text-primary-fg">{icon}</ListRowIcon>}>
      <span className="block text-body font-semibold text-text">{title}</span>
      <span className="block break-keep-wrap text-caption text-text-muted">{description}</span>
    </ListRowButton>
  );
}
