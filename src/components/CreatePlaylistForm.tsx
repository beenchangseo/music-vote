"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "./DialogProvider";
import { createPlaylist, updateCreatorNickname } from "@/actions/playlist";

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
  const [creatorNickname, setCreatorNickname] = useState("");
  const [copied, setCopied] = useState(false);
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
      prompt("링크를 복사하세요:", created.url);
    }
  }

  async function handleGoToPlaylist() {
    if (!created) return;
    // Save creator nickname if entered
    if (creatorNickname.trim()) {
      try {
        await updateCreatorNickname(created.id, creatorNickname.trim(), created.shareCode);
        localStorage.setItem(`nickname_${created.shareCode}`, creatorNickname.trim());
      } catch { /* ignore */ }
    }
    router.push(`/playlist/${created.shareCode}`);
  }

  // Success screen — QR + URL + nickname input
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

          <div className="bg-gray-800 rounded-xl p-4 inline-block mb-4">
            <img src={qrUrl} alt="QR 코드" width={160} height={160} className="mx-auto" />
          </div>

          <p className="text-xs text-gray-500 mb-4">밴드 멤버에게 QR코드를 보여주거나 링크를 공유하세요</p>

          <div className="flex gap-2 mb-4">
            <input type="text" value={created.url} readOnly className="flex-1 px-3 py-2.5 rounded-xl bg-gray-800 border border-border text-gray-300 text-sm truncate" />
            <button onClick={handleCopy} className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all active:scale-95 shrink-0">
              {copied ? "복사됨!" : "복사"}
            </button>
          </div>

          {/* Creator nickname — entered here after creation */}
          <div className="mb-4">
            <input
              type="text"
              value={creatorNickname}
              onChange={(e) => setCreatorNickname(e.target.value)}
              placeholder="방장 닉네임을 입력하세요"
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-border text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center"
            />
            <p className="text-xs text-gray-500 mt-1.5">방장 닉네임으로 공지사항 등 관리 기능을 사용합니다</p>
          </div>

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

  // Creation form — no nickname here
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

      {/* Options card */}
      <div className="mt-4 bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">옵션 설정</p>
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
              <label className="block text-sm text-gray-200 font-medium text-left">투표 마감일</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2 text-left">마감일이 지나면 투표가 종료됩니다</p>
              <div className="flex gap-2">
                <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} min={todayStr} className="flex-1 px-3 py-2.5 rounded-xl bg-gray-800 border border-border text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" style={{ colorScheme: "dark" }} />
                {deadlineDate && (
                  <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-28 px-3 py-2.5 rounded-xl bg-gray-800 border border-border text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" style={{ colorScheme: "dark" }} />
                )}
                {deadlineDate && (
                  <button type="button" onClick={() => { setDeadlineDate(""); setDeadlineTime("23:59"); }} className="p-2.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-all shrink-0" aria-label="마감일 삭제">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4"><div className="border-t border-gray-700/50" /></div>

        {/* 셋리스트 곡 수 */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-gray-200 font-medium text-left">셋리스트 곡 수</label>
              <p className="text-xs text-gray-400 mt-0.5 text-left">투표 종료 후 상위 N곡이 셋리스트로 선정됩니다</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => setSetlistCount((c) => Math.max(0, c - 1))} disabled={setlistCount <= 0} className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-800 border border-border text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30 transition-all active:scale-95" aria-label="곡 수 줄이기">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M5 12h14" /></svg>
              </button>
              <span className="w-10 text-center text-sm font-semibold text-gray-100 tabular-nums">{setlistCount > 0 ? setlistCount : "-"}</span>
              <button type="button" onClick={() => setSetlistCount((c) => Math.min(30, c + 1))} disabled={setlistCount >= 30} className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-800 border border-border text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30 transition-all active:scale-95" aria-label="곡 수 늘리기">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
