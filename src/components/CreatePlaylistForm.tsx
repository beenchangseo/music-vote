"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDialog } from "./DialogProvider";
import { createPlaylist } from "@/actions/playlist";
import { track } from "@/lib/analytics";
import KakaoShareButton from "./KakaoShareButton";

interface CreatedPlaylist {
  id: string;
  shareCode: string;
  adminToken: string;
  title: string;
  url: string;
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CreatePlaylistForm() {
  const [title, setTitle] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [setlistCount, setSetlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedPlaylist | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const { showAlert } = useDialog();
  const router = useRouter();

  const todayStr = useMemo(() => getTodayString(), []);

  const deadlineISO = useMemo(() => {
    if (!deadlineDate) return "";
    const [year, month, day] = deadlineDate.split("-").map(Number);
    const [hour, minute] = deadlineTime.split(":").map(Number);
    const d = new Date(year, month - 1, day, hour, minute, 0);
    return d.toISOString();
  }, [deadlineDate, deadlineTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    try {
      const result = await createPlaylist(
        title.trim(),
        deadlineISO || undefined,
        setlistCount > 0 ? setlistCount : undefined
      );

      track("playlist_created", {
        has_deadline: !!deadlineISO,
        setlist_count: setlistCount,
      });

      let myPlaylists = [];
      try { myPlaylists = JSON.parse(localStorage.getItem("myPlaylists") || "[]"); } catch { /* ignore */ }
      if (!Array.isArray(myPlaylists)) myPlaylists = [];
      myPlaylists.push({
        id: result.id,
        shareCode: result.shareCode,
        adminToken: result.adminToken,
        title: title.trim(),
      });
      try { localStorage.setItem("myPlaylists", JSON.stringify(myPlaylists)); } catch { /* quota */ }

      const url = `${window.location.origin}/playlist/${result.shareCode}`;
      setCreated({ ...result, title: title.trim(), url });
    } catch {
      showAlert("플레이리스트 생성에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert(`링크 복사에 실패했어요. 직접 복사해주세요:\n${created.url}`);
    }
  }

  function handleGoToPlaylist() {
    if (!created) return;
    router.push(`/playlist/${created.shareCode}`);
  }

  // Success screen — QR + URL + go-to-playlist
  if (created) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(created.url)}&bgcolor=111827&color=ffffff`;

    return (
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-upvote/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-upvote" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-text mb-1">{created.title}</h2>
          <p className="text-sm text-text-muted mb-6">
            만들었어요. 단톡방에 바로 공유해보세요.
          </p>

          {/* Primary CTA — Kakao share */}
          <KakaoShareButton
            shareCode={created.shareCode}
            variant="playlist"
            title={created.title}
            size="lg"
            visualStyle="primary"
            className="w-full mb-2"
          >
            카카오톡으로 공유
          </KakaoShareButton>

          {/* Secondary CTA — go add songs */}
          <button
            type="button"
            onClick={handleGoToPlaylist}
            className="w-full h-11 rounded-xl bg-surface-hover hover:bg-border-strong text-text font-semibold transition-all active:scale-95"
          >
            곡 추가하러 가기 →
          </button>

          {/* Tertiary — small ghost buttons */}
          <div className="flex items-center justify-center gap-1 mt-3 text-text-muted">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm hover:text-text hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h6a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
              </svg>
              {copied ? "복사됨" : "링크 복사"}
            </button>
            <span className="text-text-subtle" aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setShowQR((v) => !v)}
              aria-expanded={showQR}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm hover:text-text hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5zM15.75 4.5h4.5v4.5h-4.5zM3.75 15h4.5v4.5h-4.5zM15.75 15v4.5M19.5 19.5h.75M15.75 12h4.5M12 3.75v4.5m0 3v4.5m0 3V21" />
              </svg>
              QR 코드 {showQR ? "숨기기" : "보기"}
            </button>
          </div>

          {showQR && (
            <div className="mt-3 animate-fade-in">
              <div className="bg-surface-hover rounded-xl p-3 inline-block">
                <Image
                  src={qrUrl}
                  alt="QR 코드"
                  width={160}
                  height={160}
                  className="mx-auto"
                  unoptimized
                />
              </div>
              <p className="text-xs text-text-subtle mt-2">
                합주실에서 멤버 화면으로 보여주세요
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Creation form
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      {/* Title input — full width */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="어떤 합주예요? (예: 4월 정기 합주)"
        maxLength={100}
        className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
      />

      {/* Primary CTA — full-width below input */}
      <button
        type="submit"
        disabled={!title.trim() || loading}
        className="w-full mt-3 h-12 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center"
      >
        {loading ? (
          <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          "합주 만들기"
        )}
      </button>

      {/* Options toggle — collapsed by default */}
      {!showOptions ? (
        <button
          type="button"
          onClick={() => setShowOptions(true)}
          className="w-full mt-3 h-10 rounded-xl text-sm text-text-muted hover:text-text hover:bg-surface transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          옵션 추가 (마감일 · 셋리스트 곡 수)
        </button>
      ) : (
      /* Options card */
      <div className="mt-4 bg-surface border border-border rounded-2xl overflow-hidden animate-fade-in">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <p className="text-xs text-text-subtle uppercase tracking-wider font-semibold">옵션</p>
          <button
            type="button"
            onClick={() => { setShowOptions(false); setDeadlineDate(""); setDeadlineTime("23:59"); setSetlistCount(0); }}
            className="text-xs text-text-subtle hover:text-text transition-colors"
          >
            닫기
          </button>
        </div>

        {/* 투표 마감일 */}
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-text font-medium text-left">투표 마감일</label>
              <p className="text-xs text-text-muted mt-0.5 mb-2 text-left">마감일이 지나면 투표가 종료됩니다</p>
              <div className="flex gap-2">
                <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} min={todayStr} className="flex-1 px-3 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" style={{ colorScheme: "dark" }} />
                {deadlineDate && (
                  <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-28 px-3 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" style={{ colorScheme: "dark" }} />
                )}
                {deadlineDate && (
                  <button type="button" onClick={() => { setDeadlineDate(""); setDeadlineTime("23:59"); }} className="p-2.5 rounded-xl text-text-subtle hover:text-red-400 hover:bg-surface-hover transition-all shrink-0" aria-label="마감일 삭제">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4"><div className="border-t border-border/50" /></div>

        {/* 셋리스트 곡 수 */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-text font-medium text-left">셋리스트 곡 수</label>
              <p className="text-xs text-text-muted mt-0.5 text-left">투표 종료 후 상위 N곡이 셋리스트로 선정됩니다</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => setSetlistCount((c) => Math.max(0, c - 1))} disabled={setlistCount <= 0} className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-hover border border-border text-text-muted hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30 transition-all active:scale-95" aria-label="곡 수 줄이기">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M5 12h14" /></svg>
              </button>
              <span className={`min-w-[5rem] text-center text-sm tabular-nums ${setlistCount > 0 ? "font-semibold text-text" : "text-text-subtle"}`}>{setlistCount > 0 ? `${setlistCount}곡` : "정하지 않음"}</span>
              <button type="button" onClick={() => setSetlistCount((c) => Math.min(30, c + 1))} disabled={setlistCount >= 30} className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-hover border border-border text-text-muted hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30 transition-all active:scale-95" aria-label="곡 수 늘리기">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </form>
  );
}
