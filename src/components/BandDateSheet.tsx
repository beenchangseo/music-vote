"use client";

import { useId, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { updateTeamNextShow } from "@/actions/team";
import { track } from "@/lib/analytics";
import { kstDateString } from "@/lib/team-domain";
import { teamMessage } from "@/lib/team-messages";

interface BandDateSheetProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  nextShowAt: string | null;
  onSaved: (nextShowAt: string | null) => void;
}

/**
 * 공연 날짜 시트 (디자인 리뷰 22A). 저장을 누르기 전에는 서버에 보내지 않는다
 * (달력을 넘기는 중간 값이 저장되지 않게). `min` 은 브라우저 시간대가 아니라 KST 오늘.
 */
export default function BandDateSheet({ open, onClose, ...body }: BandDateSheetProps) {
  return (
    <Modal open={open} onClose={onClose} title="다음 공연 날짜">
      <DateSheetBody {...body} onClose={onClose} />
    </Modal>
  );
}

function DateSheetBody({ teamId, nextShowAt, onSaved, onClose }: Omit<BandDateSheetProps, "open">) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(nextShowAt ?? "");
  const [pending, setPending] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const min = kstDateString(new Date());

  async function submit(next: string | null) {
    setPending(next === null ? "clear" : "save");
    setError(null);
    try {
      const result = await updateTeamNextShow(teamId, next);
      if (!result.success) {
        setError(teamMessage(result.reason));
        return;
      }
      track("team_next_show_set", { cleared: result.nextShowAt === null });
      onSaved(result.nextShowAt);
      onClose();
    } catch (caught) {
      setError(teamMessage(caught));
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-semibold text-text">
        공연 날짜
      </label>
      <Input
        id={inputId}
        type="date"
        min={min}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="mt-2"
        style={{ colorScheme: "dark" }}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        size="lg"
        fullWidth
        className="mt-5"
        disabled={!value || pending !== null}
        loading={pending === "save"}
        onClick={() => submit(value)}
      >
        저장
      </Button>
      {nextShowAt && (
        <Button
          variant="ghost"
          fullWidth
          className="mt-2"
          disabled={pending !== null}
          loading={pending === "clear"}
          onClick={() => submit(null)}
        >
          날짜 지우기
        </Button>
      )}
    </div>
  );
}
