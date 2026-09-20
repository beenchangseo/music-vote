"use client";

import { useState, useTransition } from "react";
import Input from "./ui/Input";
import Image from "next/image";
import { useDialog } from "./DialogProvider";
import { addSong } from "@/actions/song";
import { searchSongs } from "@/actions/youtube-search";
import { extractVideoId } from "@/lib/youtube";
import { track } from "@/lib/analytics";
import type { SearchResult } from "@/lib/youtube-data";

interface AddSongFormProps {
  playlistId: string;
  shareCode: string;
  /** 로그인 모드 + 비로그인 → 폼 대신 카카오 로그인 카드 노출. */
  loginGate?: boolean;
  /** 곡이 저장된 뒤 같은 합주방의 다른 화면에 알린다. */
  onAdded?: () => void;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AddSongForm({ playlistId, shareCode, loginGate = false, onAdded }: AddSongFormProps) {
  const [input, setInput] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [showManualTitle, setShowManualTitle] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  // 로그인 모드 + 비로그인: 폼 자체를 숨김. 상단 invitation banner 가 CTA 담당.
  // (early return 은 모든 훅 호출 뒤에 — rules-of-hooks 준수)
  if (loginGate) return null;

  function resetAfterAdd() {
    setInput("");
    setManualTitle("");
    setShowManualTitle(false);
    setResults(null);
    setSearchNotice(null);
    setPreviewId(null);
  }

  async function submitUrl(url: string, title?: string) {
    const result = await addSong(playlistId, url, shareCode, title || undefined);
    if (result.needsManualTitle && !title) {
      setShowManualTitle(true);
      return;
    }
    track("song_added", { has_thumbnail: !result.needsManualTitle });
    onAdded?.();
    if (result.notEmbeddable) {
      showAlert(
        "이 영상은 외부 재생이 막혀 있어요. 곡은 추가했지만 합주 모드에서 재생되지 않을 수 있어요.",
      );
    }
    resetAfterAdd();
  }

  /**
   * 링크면 바로 추가하고, 그 외에는 검색한다.
   * 검색은 하루 한도가 있는 호출이라 이 제출 시점에만 부른다.
   * 키 입력마다 부르면 한 사람이 하루치를 다 쓴다.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || isPending) return;

    startTransition(async () => {
      try {
        if (extractVideoId(value)) {
          await submitUrl(value, manualTitle.trim());
          return;
        }

        setSearchNotice(null);
        const outcome = await searchSongs(playlistId, value);
        if (outcome.status === "too_short") {
          setSearchNotice("두 글자 이상 입력해 주세요.");
          return;
        }
        if (outcome.status === "unavailable") {
          setSearchNotice(outcome.message);
          setResults(null);
          return;
        }
        setResults(outcome.results);
        if (outcome.results.length === 0) {
          setSearchNotice("검색 결과가 없어요. 다른 말로 찾아보거나 링크를 붙여넣어 주세요.");
        }
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "곡 추가에 실패했습니다.");
      }
    });
  }

  function handleAddFromSearch(item: SearchResult) {
    if (isPending) return;
    startTransition(async () => {
      try {
        await submitUrl(`https://www.youtube.com/watch?v=${item.videoId}`);
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "곡 추가에 실패했습니다.");
      }
    });
  }

  const looksLikeLink = !!extractVideoId(input.trim());

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowManualTitle(false);
            }}
            placeholder="곡 이름으로 찾거나 YouTube 링크를 붙여넣으세요"
            enterKeyHint="search"
            className="flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || isPending}
            className="px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 text-sm shrink-0"
          >
            {isPending ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : looksLikeLink ? (
              "추가"
            ) : (
              "찾기"
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
              className="w-full px-4 py-2 rounded-xl bg-surface-hover border border-yellow-600/50 text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm"
            />
          </div>
        )}
      </form>

      {searchNotice && (
        <p className="mt-2 text-caption leading-relaxed text-text-muted" role="status">
          {searchNotice}
        </p>
      )}

      {results && results.length > 0 && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {results.map((item) => {
            const length = formatDuration(item.durationSeconds);
            const isPreviewing = previewId === item.videoId;
            return (
              <div key={item.videoId} className="rounded-xl border border-border bg-surface p-2">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewId(isPreviewing ? null : item.videoId)}
                    className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-hover"
                    aria-label={`${item.title} ${isPreviewing ? "미리듣기 닫기" : "미리듣기"}`}
                  >
                    <Image src={item.thumbnail} alt="" fill sizes="64px" className="object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        {isPreviewing ? (
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        ) : (
                          <path d="M8 5v14l11-7z" />
                        )}
                      </svg>
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-text">{item.title}</p>
                    <p className="mt-0.5 text-caption text-text-muted">
                      {item.channel}
                      {length && ` · ${length}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddFromSearch(item)}
                    disabled={isPending}
                    className="min-h-11 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>

                {isPreviewing && (
                  <iframe
                    src={`https://www.youtube.com/embed/${item.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                    title={item.title}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="mt-2 aspect-video w-full rounded-lg"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
