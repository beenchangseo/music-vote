"use client";

import { useState, useTransition } from "react";
import { useDialog } from "./DialogProvider";
import { addIntervalItem } from "@/actions/setlist";
import type { SetlistItem } from "@/lib/types";

interface AddIntervalFormProps {
  playlistId: string;
  shareCode: string;
  nextPosition: number;
  adminToken: string | null;
  onAdded: (item: SetlistItem) => void;
  onCancel: () => void;
}

export default function AddIntervalForm({ playlistId, shareCode, nextPosition, adminToken, onAdded, onCancel }: AddIntervalFormProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || isPending) return;

    const minuteValue = Number(minutes || "0");
    const secondValue = Number(seconds || "0");
    if (!Number.isInteger(minuteValue) || minuteValue < 0 || !Number.isInteger(secondValue) || secondValue < 0 || secondValue > 59) {
      showAlert("시간은 소수점 없이, 초는 0~59 사이로 입력해주세요.");
      return;
    }
    const durationSeconds = minuteValue * 60 + secondValue;

    startTransition(async () => {
      try {
        const item = await addIntervalItem(playlistId, adminToken, {
          label: label.trim(),
          description,
          duration_seconds: durationSeconds,
          position: nextPosition,
        }, shareCode);
        onAdded(item);
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "추가에 실패했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-yellow-900/10 rounded-xl border border-yellow-700/30 p-4 space-y-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="블록 이름 (예: 기타 셋업 변경)"
        maxLength={50}
        className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border text-text placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택)"
        maxLength={200}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-surface-hover px-3 py-2 text-sm text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="분"
          min="0"
          step="1"
          className="w-20 px-3 py-2 rounded-lg bg-surface-hover border border-border text-text placeholder-text-subtle text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <span className="text-text-subtle">:</span>
        <input
          type="number"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          placeholder="초"
          min="0"
          max="59"
          step="1"
          className="w-20 px-3 py-2 rounded-lg bg-surface-hover border border-border text-text placeholder-text-subtle text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-text-muted hover:text-text transition-colors">
          취소
        </button>
        <button
          type="submit"
          disabled={!label.trim() || isPending}
          className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {isPending ? "추가 중..." : "추가"}
        </button>
      </div>
    </form>
  );
}
