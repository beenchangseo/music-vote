"use client";

import { useState, type ReactNode } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import KakaoShareButton from "./KakaoShareButton";
import { useDialog } from "./DialogProvider";
import { regenerateInviteCode } from "@/actions/team";
import { teamMessage } from "@/lib/team-messages";

/**
 * "카톡으로 알리기"·"카톡으로 멤버 부르기" 처럼 초대 시트를 여는 카카오 색 버튼 (18A 토큰).
 * 밴드 홈 성공 배너와 방의 성공 카드가 같이 쓴다.
 */
export function KakaoInviteButton({
  onClick,
  children,
  className = "",
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-control bg-kakao px-4 text-sm font-semibold text-kakao-text transition-all hover:bg-kakao-hover active:scale-[0.97] ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.86 5.24 4.66 6.6l-1.18 4.32c-.1.36.31.64.61.43L11.2 19.4c.26.02.53.04.8.04 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
      </svg>
      {children}
    </button>
  );
}

interface BandInviteSheetProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  nextShowAt: string | null;
  /** owner 에게만 "링크 새로 만들기"를 보여준다. */
  isOwner: boolean;
  /** 링크를 새로 만들었을 때 새 코드 (R7). 주소(/band/{teamId})는 그대로다. */
  onInviteCodeChange: (inviteCode: string) => void;
}

/**
 * 초대 시트 (디자인 리뷰 3A): 카톡으로 보내기(주) / 링크 복사 / 주의 문구 / owner 의 링크 새로 만들기.
 * 밴드 홈 툴바 공유 아이콘, 밴드 홈 성공 배너, 방의 성공 카드가 연다.
 */
export default function BandInviteSheet({ open, onClose, ...body }: BandInviteSheetProps) {
  return (
    <Modal open={open} onClose={onClose} title="멤버 초대">
      <InviteSheetBody {...body} />
    </Modal>
  );
}

function InviteSheetBody({
  teamId,
  name,
  inviteCode,
  memberCount,
  nextShowAt,
  isOwner,
  onInviteCodeChange,
}: Omit<BandInviteSheetProps, "open" | "onClose">) {
  const { showDanger } = useDialog();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only rendered while the sheet is open, so window exists.
  const url = `${window.location.origin}/join/${inviteCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  async function rotate() {
    const ok = await showDanger(
      "지금 링크와 단톡방에 이미 보낸 초대 카드가 바로 막혀요. 멤버는 지금처럼 밴드 홈에 들어올 수 있어요.",
      { title: "초대 링크를 새로 만들까요?", confirmLabel: "새로 만들기" },
    );
    if (!ok) return;
    setRotating(true);
    setError(null);
    try {
      const result = await regenerateInviteCode(teamId);
      if (result.success) {
        onInviteCodeChange(result.inviteCode);
        setRotated(true);
        setCopyState("idle");
      } else {
        setError(teamMessage(result.reason));
      }
    } catch (caught) {
      setError(teamMessage(caught));
    } finally {
      setRotating(false);
    }
  }

  return (
    <div>
      <p className="truncate rounded-control border border-border bg-surface px-3 py-2.5 text-sm text-text-muted" title={url}>
        {url}
      </p>

      <KakaoShareButton
        linkPath={`/join/${inviteCode}`}
        variant="band"
        title={name}
        showDate={nextShowAt}
        members={memberCount}
        size="lg"
        className="mt-3 w-full"
        ariaLabel="카톡으로 보내기"
      >
        카톡으로 보내기
      </KakaoShareButton>
      <Button variant="secondary" size="lg" fullWidth className="mt-2" onClick={copy}>
        {copyState === "copied" ? "복사했어요" : "링크 복사"}
      </Button>
      {copyState === "failed" && (
        <p role="alert" className="mt-2 text-sm text-danger">
          복사하지 못했어요. 위 링크를 길게 눌러 복사해 주세요
        </p>
      )}

      <p className="mt-3 text-caption leading-relaxed text-text-muted">이 링크를 받은 사람은 누구나 들어올 수 있어요</p>

      {isOwner && (
        <div className="mt-5 border-t border-border pt-4">
          <Button variant="ghost" fullWidth loading={rotating} onClick={rotate}>
            링크 새로 만들기
          </Button>
          {rotated && !error && (
            <p role="status" className="mt-2 text-caption text-text-muted">
              새 링크를 만들었어요. 예전 링크는 이제 열리지 않아요
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
