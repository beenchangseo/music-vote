"use client";

import { useState, useTransition } from "react";
import { useDialog } from "./DialogProvider";
import { addSetlistItem } from "@/actions/setlist";
import type { SetlistItem } from "@/lib/types";

interface AddIntervalFormProps {
  playlistId: string;
  adminToken: string;
  shareCode: string;
  nextPosition: number;
  onAdded: (item: SetlistItem) => void;
  onCancel: () => void;
}

export default function AddIntervalForm({ playlistId, adminToken, shareCode, nextPosition, onAdded, onCancel }: AddIntervalFormProps) {
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || isPending) return;

    const durationSeconds = (parseInt(minutes || "0") * 60) + parseInt(seconds || "0");

    startTransition(async () => {
      try {
        const item = await addSetlistItem(playlistId, adminToken, {
          item_type: "interval",
          label: label.trim(),
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
        placeholder="인터벌 설명 (예: 보컬 멘트, 기타 셋업 체인지)"
        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-border text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="분"
          min="0"
          max="60"
          className="w-20 px-3 py-2 rounded-lg bg-gray-800 border border-border text-gray-100 placeholder-gray-500 text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <span className="text-gray-500">:</span>
        <input
          type="number"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          placeholder="초"
          min="0"
          max="59"
          className="w-20 px-3 py-2 rounded-lg bg-gray-800 border border-border text-gray-100 placeholder-gray-500 text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
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
