"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Avatar from "../ui/Avatar";
import {
  deleteAccount,
  previewAccountDeletion,
  type AccountDeletionPreview,
  type DeleteAccountResult,
} from "@/actions/account";
import { useDialog } from "@/components/ui/DialogProvider";
import { dialogLayerOpen } from "@/components/ui/focus-trap";

const DELETE_ACCOUNT_RECORDS =
  "내 투표와 댓글, 플레이리스트·밴드 참여 기록이 지워져요. 내가 추가한 곡은 남고 이름만 '탈퇴한 멤버'로 바뀌어요.\n\n" +
  "내가 만든 플레이리스트는 방장이 없는 보관 플레이리스트가 돼요. 멤버들이 지난 기록은 볼 수 있지만 더는 투표하거나 곡을 추가할 수 없어요.";

function deleteAccountMessage(handovers: Extract<AccountDeletionPreview, { success: true }>["handovers"]) {
  const paragraphs = [DELETE_ACCOUNT_RECORDS];
  if (handovers.length > 0) {
    paragraphs.push(handovers.map(({ bandName, ownerName }) => `'${bandName}' 밴드는 ${ownerName}님이 맡아요.`).join("\n"));
  }
  paragraphs.push("탈퇴하면 되돌릴 수 없어요.");
  return paragraphs.join("\n\n");
}

type DeletePhase = "idle" | "checking" | "deleting";

const DELETE_LABEL: Record<DeletePhase, string> = {
  idle: "탈퇴하기",
  checking: "확인하는 중…",
  deleting: "탈퇴하는 중…",
};

const RETRY_LATER = "탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.";

type DeleteFailure = Extract<DeleteAccountResult, { success: false }>["reason"];

const DELETE_FAILED: Record<Exclude<DeleteFailure, "not_logged_in">, string> = {
  not_available: "지금은 앱에서 탈퇴할 수 없어요. 아무것도 지우지 않았어요.",
  kakao_unlink_failed: RETRY_LATER,
  write_failed: RETRY_LATER,
};

interface AuthMenuProps {
  nickname: string;
  avatarUrl: string | null;
  /** PlaylistHeader 내부 등 명시적 배치 시 true. fixed 글로벌 슬롯과 별개. */
  embedded?: boolean;
}

export default function AuthMenu({ nickname, avatarUrl, embedded = false }: AuthMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { showDanger, showAlert } = useDialog();
  const [deletePhase, setDeletePhase] = useState<DeletePhase>("idle");

  useEffect(() => {
    if (!open) return;
    // Same rule as Modal: input on the delete confirm belongs to the confirm, so the menu stays
    // open behind it and shows "탈퇴하는 중…" afterwards.
    function onClick(e: MouseEvent) {
      if (dialogLayerOpen()) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || dialogLayerOpen()) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The session ended (signed out in another tab, or an earlier try already deleted the account).
  // Do not claim a deletion that may not have happened.
  function sessionEnded() {
    void showAlert("로그인이 풀렸어요. 탈퇴하려면 다시 로그인해 주세요.").then(() => window.location.reload());
  }

  async function confirmDeleteAccount() {
    setDeletePhase("checking");
    let preview: AccountDeletionPreview;
    try {
      preview = await previewAccountDeletion();
    } catch {
      preview = { success: false, reason: "read_failed" };
    }
    setDeletePhase("idle");
    if (!preview.success) {
      if (preview.reason === "not_logged_in") sessionEnded();
      else void showAlert("탈퇴 안내를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    const ok = await showDanger(deleteAccountMessage(preview.handovers), {
      title: "탈퇴할까요?",
      confirmLabel: "탈퇴하기",
    });
    if (!ok) return;

    setDeletePhase("deleting");
    let result: DeleteAccountResult;
    try {
      result = await deleteAccount();
    } catch {
      result = { success: false, reason: "write_failed" };
    }
    // A full load, not router.push: the client router cache still holds the signed-in pages.
    if (result.success) {
      window.location.assign("/");
      return;
    }
    setDeletePhase("idle");
    if (result.reason === "not_logged_in") sessionEnded();
    else void showAlert(DELETE_FAILED[result.reason]);
  }

  // 플리 페이지는 PlaylistHeader 가 embedded AuthMenu 를 자체 렌더 → 글로벌 fixed 슬롯은 숨김.
  // (early return 은 모든 훅 호출 뒤에 — rules-of-hooks 준수)
  if (!embedded && pathname?.startsWith("/playlist/")) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${nickname} 계정 메뉴`}
        aria-expanded={open}
        className="group block rounded-pill"
      >
        <Avatar name={nickname} src={avatarUrl} size="md" className="ring-1 ring-border transition-shadow group-hover:ring-border-strong" />
      </button>

      {open && (
        // z-40: the playlist header renders this menu embedded (outside the fixed z-50 slot), and the
        // cover below it is positioned, so without a z-index the cover painted over the menu. Below sheets (z-[90]).
        <div className="absolute right-0 top-11 z-40 w-44 rounded-control border border-border bg-surface shadow-float animate-fade-in overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-caption text-text-subtle">로그인됨</p>
            <p className="text-sm font-medium text-text truncate">{nickname}</p>
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="w-full text-left px-3 py-2.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
            >
              로그아웃
            </button>
          </form>
          <button
            type="button"
            onClick={confirmDeleteAccount}
            disabled={deletePhase !== "idle"}
            className="flex min-h-11 w-full items-center border-t border-border px-3 text-left text-sm text-danger hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            {DELETE_LABEL[deletePhase]}
          </button>
        </div>
      )}
    </div>
  );
}
