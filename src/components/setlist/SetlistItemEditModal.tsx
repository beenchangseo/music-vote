"use client";

import { useState, useTransition } from "react";
import Button from "../ui/Button";
import ButtonGroup from "../ui/ButtonGroup";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Textarea from "../ui/Textarea";
import { useDialog } from "../ui/DialogProvider";
import { resetSongSetlistItem, updateIntervalItem, updateOriginalItem, updateSongSetlistItem } from "@/actions/setlist";
import { effectiveSetlistDuration, effectiveSetlistTitle } from "@/domain/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";

interface Props {
  item: SetlistItem;
  song?: SongWithScore | null;
  playlistId: string;
  shareCode: string;
  onSaved: (item: SetlistItem) => void;
  onClose: () => void;
}

export default function SetlistItemEditModal(props: Props) {
  const isInterval = props.item.item_type === "interval";
  const isOriginal = props.item.item_type === "original";
  const isBlock = isInterval || isOriginal;
  const initialDuration = isBlock ? props.item.duration_seconds : props.song ? effectiveSetlistDuration(props.item, props.song) || 0 : 0;
  const [title, setTitle] = useState(isBlock ? props.item.label || "" : props.song ? effectiveSetlistTitle(props.item, props.song) : "");
  const [description, setDescription] = useState(props.item.description || "");
  const [minutes, setMinutes] = useState(String(Math.floor(initialDuration / 60)));
  const [seconds, setSeconds] = useState(String(initialDuration % 60));
  const [isPending, startTransition] = useTransition();
  const { showAlert, showConfirm } = useDialog();

  const minuteValue = Number(minutes || 0);
  const secondValue = Number(seconds || 0);
  const duration = minuteValue * 60 + secondValue;
  const valid = title.trim() && Number.isInteger(minuteValue) && minuteValue >= 0 && Number.isInteger(secondValue) && secondValue >= 0 && secondValue <= 59;

  function save() {
    if (!valid || isPending) return;
    startTransition(async () => {
      try {
        const next = isInterval
          ? await updateIntervalItem(props.playlistId, props.item.id, { label: title, description, duration_seconds: duration }, props.shareCode)
          : isOriginal
            ? await updateOriginalItem(props.playlistId, props.item.id, { label: title, description, duration_seconds: duration }, props.shareCode)
            : await updateSongSetlistItem(props.playlistId, props.item.id, title, duration, props.shareCode);
        props.onSaved(next);
        props.onClose();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "수정에 실패했습니다.");
      }
    });
  }

  async function reset() {
    const ok = await showConfirm("후보곡 탭에 보이는 제목과 영상 길이로 돌아가요.", "고친 제목과 시간을 되돌릴까요?");
    if (!ok) return;
    startTransition(async () => {
      try {
        const next = await resetSongSetlistItem(props.playlistId, props.item.id, props.shareCode);
        props.onSaved(next);
        props.onClose();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "초기화에 실패했습니다.");
      }
    });
  }

  return (
    <Modal open onClose={props.onClose} title={isInterval ? "인터벌 블록 수정" : isOriginal ? "자작곡 수정" : "곡 블록 수정"}>
      <div className={`flex flex-col gap-4 ${isPending ? "pointer-events-none opacity-70" : ""}`}>
        <Field label={isInterval ? "블록 이름" : isOriginal ? "자작곡 이름" : "곡 제목"}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={isInterval ? 50 : isOriginal ? 100 : 200} />
        </Field>
        {isBlock && (
          <Field label="설명" help={`${description.length}/200`}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={3} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="분">
            <Input type="number" min={0} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="tabular-nums" />
          </Field>
          <Field label="초">
            <Input type="number" min={0} max={59} step={1} value={seconds} onChange={(e) => setSeconds(e.target.value)} className="tabular-nums" />
          </Field>
        </div>
        <div className="mt-2 flex gap-2">
          {!isBlock && (
            <Button variant="ghost" onClick={reset}>
              초기화
            </Button>
          )}
          <ButtonGroup className="flex-1">
            <Button variant="tonal" onClick={props.onClose}>
              취소
            </Button>
            <Button onClick={save} disabled={!valid}>
              저장
            </Button>
          </ButtonGroup>
        </div>
      </div>
    </Modal>
  );
}
