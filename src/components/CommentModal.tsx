"use client";

import { useState, useTransition, useEffect } from "react";
import { useDialog } from "./DialogProvider";
import { addOrUpdateComment, deleteComment, getCommentsBySong } from "@/actions/comment";
import type { Comment } from "@/lib/types";

interface CommentModalProps {
  songId: string;
  songTitle: string;
  nickname: string;
  shareCode: string;
  onClose: () => void;
}

export default function CommentModal({ songId, songTitle, nickname, shareCode, onClose }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showAlert, showDanger } = useDialog();

  const myComment = nickname ? comments.find((c) => c.nickname.toLowerCase() === nickname.toLowerCase()) : null;

  // Load comments on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getCommentsBySong(songId);
        setComments(data);
        const mine = data.find((c) => c.nickname.toLowerCase() === nickname.toLowerCase());
        if (mine) setContent(mine.content);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [songId, nickname]);

  function handleSubmit() {
    if (!nickname || !content.trim() || isPending) return;

    startTransition(async () => {
      try {
        await addOrUpdateComment(songId, nickname, content.trim(), shareCode);
        // Refresh
        const data = await getCommentsBySong(songId);
        setComments(data);
        setIsEditing(false);
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "댓글 저장에 실패했습니다.");
      }
    });
  }

  async function handleDelete() {
    if (!nickname) return;
    const ok = await showDanger("댓글을 삭제하시겠습니까?");
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteComment(songId, nickname, shareCode);
        setComments((prev) => prev.filter((c) => c.nickname.toLowerCase() !== nickname.toLowerCase()));
        setContent("");
        setIsEditing(false);
      } catch {
        showAlert("댓글 삭제에 실패했습니다.");
      }
    });
  }

  const otherComments = comments.filter((c) => c.nickname.toLowerCase() !== nickname.toLowerCase());

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-900 border-t border-border rounded-t-2xl animate-slide-up max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate flex-1">{songTitle}</h3>
          <span className="text-xs text-gray-500 mx-2">{comments.length}개 댓글</span>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <span className="inline-block w-6 h-6 border-2 border-gray-600 border-t-primary rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 && !nickname ? (
            <p className="text-center text-sm text-gray-500 py-8">아직 댓글이 없습니다</p>
          ) : (
            <>
              {otherComments.map((c) => (
                <div key={c.id} className="bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary/80">{c.nickname}</span>
                    <span className="text-[10px] text-gray-600">
                      {new Date(c.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                </div>
              ))}

              {/* My comment */}
              {myComment && !isEditing && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary">{nickname} (나)</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setIsEditing(true); setContent(myComment.content); }} className="text-[10px] text-gray-500 hover:text-gray-300">수정</button>
                      <button onClick={handleDelete} className="text-[10px] text-gray-500 hover:text-red-400">삭제</button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{myComment.content}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Write/Edit form */}
        {nickname && (!myComment || isEditing) && (
          <div className="px-4 py-3 border-t border-border shrink-0">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`${nickname}의 메모를 남겨보세요`}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-border text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-gray-600">{content.length}/1000</span>
              <div className="flex gap-2">
                {isEditing && (
                  <button onClick={() => { setIsEditing(false); setContent(myComment?.content || ""); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300">
                    취소
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || isPending}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold disabled:opacity-50 transition-all active:scale-95"
                >
                  {isPending ? "저장 중..." : myComment ? "수정" : "작성"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!nickname && (
          <div className="px-4 py-3 border-t border-border text-center shrink-0">
            <p className="text-xs text-gray-500">닉네임을 입력하면 댓글을 작성할 수 있습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
