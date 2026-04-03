"use client";

import { useState, useTransition } from "react";
import { useDialog } from "./DialogProvider";
import { addOrUpdateComment } from "@/actions/comment";
import type { Comment } from "@/lib/types";

interface CommentSectionProps {
  songId: string;
  comments: Comment[];
  nickname: string;
  shareCode: string;
  onCommentsChange: (comments: Comment[]) => void;
  allComments: Comment[];
}

export default function CommentSection({ songId, comments, nickname, shareCode, onCommentsChange, allComments }: CommentSectionProps) {
  const myComment = nickname ? comments.find((c) => c.nickname.toLowerCase() === nickname.toLowerCase()) : null;
  const [content, setContent] = useState(myComment?.content || "");
  const [isEditing, setIsEditing] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleSubmit() {
    if (!nickname || !content.trim() || isPending) return;

    startTransition(async () => {
      try {
        await addOrUpdateComment(songId, nickname, content.trim(), shareCode);
        // Optimistic update
        const now = new Date().toISOString();
        if (myComment) {
          const updated = allComments.map((c) =>
            c.id === myComment.id ? { ...c, content: content.trim(), updated_at: now } : c
          );
          onCommentsChange(updated);
        } else {
          onCommentsChange([...allComments, {
            id: crypto.randomUUID(),
            song_id: songId,
            nickname,
            content: content.trim(),
            created_at: now,
            updated_at: now,
          }]);
        }
        setIsEditing(false);
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "댓글 저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="px-3 py-2">
      {/* Other comments — show max 2, expandable */}
      {(() => {
        const others = comments.filter((c) => c.nickname.toLowerCase() !== nickname.toLowerCase());
        const visible = showAllComments ? others : others.slice(0, 2);
        return (
          <>
            {visible.map((c) => (
              <div key={c.id} className="mb-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-primary/70 truncate max-w-[120px]">{c.nickname}</span>
                  <span className="text-[10px] text-gray-600">{new Date(c.updated_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {others.length > 2 && !showAllComments && (
              <button onClick={() => setShowAllComments(true)} className="text-xs text-primary/70 hover:text-primary mb-1">
                댓글 {others.length - 2}개 더보기
              </button>
            )}
          </>
        );
      })()}

      {/* My comment */}
      {nickname && (
        <div className="mt-2">
          {myComment && !isEditing ? (
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-primary">{nickname} (나)</span>
                <button onClick={() => setIsEditing(true)} className="text-[10px] text-gray-500 hover:text-gray-300">수정</button>
              </div>
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{myComment.content}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`${nickname}의 메모를 남겨보세요 (1000자)`}
                maxLength={1000}
                rows={2}
                className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-border text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">{content.length}/1000</span>
                <div className="flex gap-2">
                  {isEditing && (
                    <button onClick={() => { setIsEditing(false); setContent(myComment?.content || ""); }} className="text-xs text-gray-500">취소</button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || isPending}
                    className="px-3 py-1 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "저장 중..." : myComment ? "수정" : "작성"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
