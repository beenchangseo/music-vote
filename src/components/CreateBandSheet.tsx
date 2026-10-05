"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { createTeamFromPlaylist } from "@/actions/team";
import { getVotingSettings } from "@/actions/member";
import { track } from "@/lib/analytics";
import { TEAM_NAME_MAX } from "@/lib/team-domain";
import { teamMessage } from "@/lib/team-messages";

/** 방에서 막 만든 밴드. 방에 머무는 성공 카드와 초대 시트가 쓴다 (D30A·R6). */
export interface CreatedBand {
  teamId: string;
  name: string;
  inviteCode: string;
  memberCount: number;
}

interface CreateBandSheetProps {
  open: boolean;
  onClose: () => void;
  playlistId: string;
  adminToken: string | null;
  /** team_created 이벤트의 출처. 방 설정 행이면 settings, 안내 카드면 card. */
  source: "card" | "settings";
  onCreated: (band: CreatedBand) => void;
}

/**
 * "이 멤버로 밴드 만들기" 시트 (디자인 리뷰 9A·10A). 방 설정 행과 안내 카드(F7)가 같이 연다.
 * 이름은 비운 채 자동 포커스 (방 제목은 보통 공연 이름이라 미리 채우지 않는다).
 */
export default function CreateBandSheet({ open, onClose, ...body }: CreateBandSheetProps) {
  // initialFocus instead of autoFocus so focus goes back to the opener on close.
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={open} onClose={onClose} title="밴드 만들기" initialFocus={inputRef}>
      <CreateBandBody {...body} onClose={onClose} inputRef={inputRef} />
    </Modal>
  );
}

function CreateBandBody({
  playlistId,
  adminToken,
  source,
  onCreated,
  onClose,
  inputRef,
}: Omit<CreateBandSheetProps, "open"> & { inputRef: RefObject<HTMLInputElement | null> }) {
  const inputId = useId();
  const helpId = useId();
  const [name, setName] = useState("");
  // Participants who become members. Reuses the owner-only room settings read (member.ts).
  const [memberNames, setMemberNames] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getVotingSettings(playlistId, adminToken)
      .then((settings) => {
        if (active) setMemberNames(settings.members.map((member) => member.display_name));
      })
      .catch(() => {
        // The preview is a courtesy; the server copies the participants either way.
        if (active) setMemberNames([]);
      });
    return () => {
      active = false;
    };
  }, [playlistId, adminToken]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await createTeamFromPlaylist(playlistId, name);
      if (!result.success) {
        setError(teamMessage(result.reason));
        return;
      }
      track("team_created", { source });
      onCreated({
        teamId: result.teamId,
        name: result.name,
        inviteCode: result.inviteCode,
        memberCount: result.memberCount,
      });
    } catch (caught) {
      setError(teamMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={inputId} className="text-sm font-semibold text-text">
        밴드 이름
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={TEAM_NAME_MAX}
        aria-describedby={helpId}
        invalid={!!error}
        className="mt-2"
        autoComplete="off"
      />
      <p id={helpId} className="mt-2 text-caption leading-relaxed text-text-muted">
        나중에 바꿀 수 없어요. 공연 이름 말고 밴드 이름을 써 주세요
      </p>

      <div className="mt-4 rounded-control border border-border bg-surface px-3 py-2.5">
        {memberNames === null ? (
          <p className="text-sm text-text-muted">참여자를 불러오는 중…</p>
        ) : memberNames.length > 0 ? (
          <>
            <p className="text-sm font-medium text-text">이 플레이리스트 참여자 {memberNames.length}명이 멤버가 돼요</p>
            <p className="mt-1 text-caption leading-relaxed text-text-muted">{memberNames.join(", ")}</p>
          </>
        ) : (
          <p className="text-sm text-text-muted">이 플레이리스트 참여자가 모두 멤버가 돼요</p>
        )}
      </div>

      <Button type="submit" size="lg" fullWidth className="mt-5" disabled={!name.trim()} loading={pending}>
        밴드 만들기
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="button" variant="ghost" fullWidth className="mt-2" onClick={onClose}>
        나중에
      </Button>
    </form>
  );
}
