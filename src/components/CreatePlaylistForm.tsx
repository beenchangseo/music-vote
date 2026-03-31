"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlaylist } from "@/actions/playlist";

interface CreatedPlaylist {
  id: string;
  shareCode: string;
  adminToken: string;
  title: string;
  url: string;
}

export default function CreatePlaylistForm() {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [showDeadline, setShowDeadline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedPlaylist | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    try {
      const result = await createPlaylist(title.trim(), deadline || undefined);

      // Save admin token to localStorage
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
      alert("플레이리스트 생성에 실패했습니다. 다시 시도해주세요.");
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
      prompt("링크를 복사하세요:", created.url);
    }
  }

  function handleGoToPlaylist() {
    if (created) router.push(`/playlist/${created.shareCode}`);
  }

  // QR + URL Modal after creation
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

          <h2 className="text-xl font-bold text-gray-100 mb-1">{created.title}</h2>
          <p className="text-sm text-gray-400 mb-6">플레이리스트가 생성되었습니다!</p>

          {/* QR Code */}
          <div className="bg-gray-800 rounded-xl p-4 inline-block mb-4">
            <img
              src={qrUrl}
              alt="QR 코드"
              width={160}
              height={160}
              className="mx-auto"
            />
          </div>

          <p className="text-xs text-gray-500 mb-4">밴드 멤버에게 QR코드를 보여주거나 링크를 공유하세요</p>

          {/* URL Copy */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={created.url}
              readOnly
              className="flex-1 px-3 py-2.5 rounded-xl bg-gray-800 border border-border text-gray-300 text-sm truncate"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all active:scale-95 shrink-0"
            >
              {copied ? "복사됨!" : "복사"}
            </button>
          </div>

          {/* Go to playlist */}
          <button
            onClick={handleGoToPlaylist}
            className="w-full px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold transition-all active:scale-95"
          >
            플레이리스트로 이동 &rarr;
          </button>
        </div>
      </div>
    );
  }

  // Creation form
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="플레이리스트 이름을 입력하세요"
          maxLength={100}
          className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "만들기"
          )}
        </button>
      </div>

      {/* Deadline toggle */}
      <div className="mt-3">
        {!showDeadline ? (
          <button
            type="button"
            onClick={() => setShowDeadline(true)}
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            + 투표 마감일 설정
          </button>
        ) : (
          <div className="flex items-center gap-2 animate-fade-in">
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => { setShowDeadline(false); setDeadline(""); }}
              className="text-sm text-gray-500 hover:text-red-400 transition-colors shrink-0"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
