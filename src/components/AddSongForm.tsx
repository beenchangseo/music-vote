"use client";

import { useState, useTransition } from "react";
import { useDialog } from "./DialogProvider";
import { addSong } from "@/actions/song";

interface AddSongFormProps {
  playlistId: string;
  shareCode: string;
  nickname: string;
}

type InputMode = "url" | "search";

export default function AddSongForm({ playlistId, shareCode, nickname }: AddSongFormProps) {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [showManualTitle, setShowManualTitle] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || isPending) return;

    startTransition(async () => {
      try {
        const result = await addSong(playlistId, url.trim(), shareCode, nickname || undefined, manualTitle.trim() || undefined);
        if (result.needsManualTitle && !manualTitle) {
          setShowManualTitle(true);
          return;
        }
        setUrl("");
        setManualTitle("");
        setShowManualTitle(false);
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "곡 추가에 실패했습니다.");
      }
    });
  }

  return (
    <div className="w-full">
      {/* Mode toggle */}
      <div className="flex bg-gray-800 rounded-lg p-0.5 mb-3">
        <button
          onClick={() => setMode("url")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "url" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          URL
        </button>
        <button
          onClick={() => setMode("search")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "search" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          검색
        </button>
      </div>

      {mode === "url" ? (
        <form onSubmit={handleUrlSubmit}>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setShowManualTitle(false);
              }}
              placeholder="YouTube URL을 붙여넣으세요"
              enterKeyHint="send"
              className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-border text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
            />
            <button
              type="submit"
              disabled={!url.trim() || isPending}
              className="px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 text-sm shrink-0"
            >
              {isPending ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "추가"
              )}
            </button>
          </div>
          {showManualTitle && (
            <div className="mt-2 animate-fade-in">
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="곡 제목을 직접 입력해주세요 (메타데이터를 가져올 수 없습니다)"
                className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-yellow-600/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm"
              />
            </div>
          )}
        </form>
      ) : (
        <div className="text-center py-8">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p className="text-sm text-gray-400">검색 기능 준비 중</p>
          <p className="text-xs text-gray-500 mt-1">YouTube URL로 곡을 추가해주세요</p>
        </div>
      )}
    </div>
  );
}
