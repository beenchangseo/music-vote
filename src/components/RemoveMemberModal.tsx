"use client";

import { useRef, useState, type RefObject } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { removeTeamMember } from "@/actions/team";
import { teamMessage } from "@/lib/team-messages";

interface RemoveMemberModalProps {
  teamId: string;
  /** 내보낼 멤버. null 이면 닫혀 있다. */
  member: { userId: string; displayName: string } | null;
  onClose: () => void;
  /** `rotated`: the invite link was replaced in the same request. */
  onRemoved: (userId: string, rotated: boolean) => void;
  /** 링크가 바뀌었으면 새 초대 코드. 내보내기가 실패해도 이미 바뀐 링크는 알려준다. */
  onInviteRotated: (inviteCode: string) => void;
}

/**
 * owner 의 "내보내기" 확인 (디자인 리뷰 19A). 폼(체크박스)이 있어 useDialog 가 아니라 Modal 위에 선다.
 * "초대 링크도 새로 만들기"는 기본 꺼짐 (24B).
 */
export default function RemoveMemberModal({ teamId, member, onClose, ...rest }: RemoveMemberModalProps) {
  // Irreversible: start on 취소 so a stray Enter does not remove anyone (same rule as R11).
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      title={member ? `${member.displayName}님을 밴드에서 내보낼까요?` : undefined}
      initialFocus={cancelRef}
    >
      {member && (
        <RemoveMemberBody
          key={member.userId}
          teamId={teamId}
          member={member}
          onClose={onClose}
          cancelRef={cancelRef}
          {...rest}
        />
      )}
    </Modal>
  );
}

function RemoveMemberBody({
  teamId,
  member,
  onClose,
  onRemoved,
  onInviteRotated,
  cancelRef,
}: Omit<RemoveMemberModalProps, "member"> & {
  member: { userId: string; displayName: string };
  cancelRef: RefObject<HTMLButtonElement | null>;
}) {
  const [rotate, setRotate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const result = await removeTeamMember(teamId, member.userId, rotate);
      if (result.inviteCode) onInviteRotated(result.inviteCode);
      if (result.success) {
        onRemoved(member.userId, result.inviteCode !== null);
        onClose();
        return;
      }
      // The link may already be new; pressing again must not rotate it a second time.
      if (result.inviteCode) setRotate(false);
      setError(teamMessage(result.reason));
    } catch (caught) {
      setError(teamMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={rotate}
          onChange={(e) => setRotate(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-text">초대 링크도 새로 만들기</span>
          <span className="mt-1 block text-caption leading-relaxed text-text-muted">
            켜면 지금 단톡방에 있는 초대 카드도 모두 막혀요. 꺼 두면 이 사람이 같은 링크로 다시 들어올 수 있어요.
          </span>
        </span>
      </label>

      <div className="mt-5 flex gap-2">
        <Button ref={cancelRef} variant="secondary" className="flex-1" onClick={onClose} disabled={pending}>
          취소
        </Button>
        <Button variant="danger" className="flex-1" loading={pending} onClick={remove}>
          내보내기
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
