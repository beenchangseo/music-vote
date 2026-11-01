"use client";

import { useId, useState } from "react";
import Button from "../ui/Button";
import ButtonGroup from "../ui/ButtonGroup";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { BLOCK_DESCRIPTION_MAX, BLOCK_LABEL_MAX, type NewSetlistBlock } from "@/domain/setlist";

type FieldsBlock = Extract<NewSetlistBlock, { kind: "interval" | "original" }>;

const COPY = {
  interval: { placeholder: "예: 기타 셋업 변경", seconds: 60 },
  original: { placeholder: "예: 우리 자작곡 (가제)", seconds: 180 },
} as const;

interface Props {
  kind: FieldsBlock["kind"];
  pending: boolean;
  /** 서버가 거절한 이유. */
  error: string | null;
  onSubmit: (block: FieldsBlock) => void;
  onBack: () => void;
}

/** 인터벌·자작곡 블록 입력. 이름, 설명, 분·초. 시간은 종류별 기본값으로 채워 둔다. */
export default function BlockForm({ kind, pending, error, onSubmit, onBack }: Props) {
  const { placeholder, seconds: defaultSeconds } = COPY[kind];
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(String(Math.floor(defaultSeconds / 60)));
  const [seconds, setSeconds] = useState(String(defaultSeconds % 60));
  const [timeError, setTimeError] = useState<string | null>(null);
  const timeErrorId = useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim() || pending) return;
    const minuteValue = Number(minutes || "0");
    const secondValue = Number(seconds || "0");
    if (!Number.isInteger(minuteValue) || minuteValue < 0 || !Number.isInteger(secondValue) || secondValue < 0 || secondValue > 59) {
      setTimeError("분은 0 이상, 초는 0~59 로 써 주세요");
      return;
    }
    setTimeError(null);
    onSubmit({ kind, label: label.trim(), description, durationSeconds: minuteValue * 60 + secondValue });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="이름">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={placeholder} maxLength={BLOCK_LABEL_MAX[kind]} autoComplete="off" />
      </Field>
      <Field label="설명 (선택)">
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={BLOCK_DESCRIPTION_MAX} rows={2} />
      </Field>
      <div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="분">
            <Input value={minutes} onChange={(event) => setMinutes(event.target.value)} inputMode="numeric" invalid={!!timeError} aria-describedby={timeError ? timeErrorId : undefined} className="tabular-nums" />
          </Field>
          <Field label="초">
            <Input value={seconds} onChange={(event) => setSeconds(event.target.value)} inputMode="numeric" invalid={!!timeError} aria-describedby={timeError ? timeErrorId : undefined} className="tabular-nums" />
          </Field>
        </div>
        {timeError && (
          <p id={timeErrorId} className="mt-1.5 text-caption text-danger-fg">
            {timeError}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-fg">
          {error}
        </p>
      )}
      <ButtonGroup>
        <Button type="button" variant="tonal" onClick={onBack}>
          뒤로
        </Button>
        <Button type="submit" loading={pending} disabled={!label.trim()}>
          넣기
        </Button>
      </ButtonGroup>
    </form>
  );
}
