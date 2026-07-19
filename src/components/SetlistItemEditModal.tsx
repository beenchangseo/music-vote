"use client";

import { useState, useTransition } from "react";
import Modal from "./ui/Modal";
import { useDialog } from "./DialogProvider";
import { resetSongSetlistItem, updateIntervalItem, updateSongSetlistItem } from "@/actions/setlist";
import { effectiveSetlistDuration, effectiveSetlistTitle } from "@/lib/setlist-domain";
import type { SetlistItem, SongWithScore } from "@/lib/types";

interface Props {
  item: SetlistItem;
  song?: SongWithScore | null;
  playlistId: string;
  shareCode: string;
  adminToken: string | null;
  onSaved: (item: SetlistItem) => void;
  onClose: () => void;
}

export default function SetlistItemEditModal(props: Props) {
  const isInterval = props.item.item_type === "interval";
  const initialDuration = isInterval ? props.item.duration_seconds : props.song ? effectiveSetlistDuration(props.item, props.song) || 0 : 0;
  const [title, setTitle] = useState(isInterval ? props.item.label || "" : props.song ? effectiveSetlistTitle(props.item, props.song) : "");
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
          ? await updateIntervalItem(props.playlistId, props.adminToken, props.item.id, { label: title, description, duration_seconds: duration }, props.shareCode)
          : await updateSongSetlistItem(props.playlistId, props.adminToken, props.item.id, title, duration, props.shareCode);
        props.onSaved(next);
        props.onClose();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "수정에 실패했습니다.");
      }
    });
  }

  async function reset() {
    const ok = await showConfirm("투표 리스트의 원본 제목과 시간으로 초기화할까요?");
    if (!ok) return;
    startTransition(async () => {
      try {
        const next = await resetSongSetlistItem(props.playlistId, props.adminToken, props.item.id, props.shareCode);
        props.onSaved(next);
        props.onClose();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "초기화에 실패했습니다.");
      }
    });
  }

  return (
    <Modal open onClose={props.onClose} title={isInterval ? "인터벌 블록 수정" : "곡 블록 수정"}>
      <div className={isPending ? "pointer-events-none opacity-70" : ""}>
        <label className="text-sm font-medium text-text">{isInterval ? "블록 이름" : "곡 제목"}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={isInterval ? 50 : 200} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface-hover px-3 text-sm text-text" />
        {isInterval && (
          <>
            <label className="mt-4 block text-sm font-medium text-text">설명</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-surface-hover px-3 py-2 text-sm text-text" />
            <p className="mt-1 text-right text-caption text-text-subtle">{description.length}/200</p>
          </>
        )}
        <label className="mt-4 block text-sm font-medium text-text">시간</label>
        <div className="mt-2 flex items-center gap-2">
          <input type="number" min={0} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-hover px-3 text-center text-text" aria-label="분" />
          <span className="text-text-muted">분</span>
          <input type="number" min={0} max={59} step={1} value={seconds} onChange={(e) => setSeconds(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-hover px-3 text-center text-text" aria-label="초" />
          <span className="text-text-muted">초</span>
        </div>
        <div className="mt-6 flex gap-2">
          {!isInterval && <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-text-muted">초기화</button>}
          <button type="button" onClick={props.onClose} className="ml-auto min-h-11 px-4 text-sm text-text-muted">취소</button>
          <button type="button" onClick={save} disabled={!valid} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">저장</button>
        </div>
      </div>
    </Modal>
  );
}
