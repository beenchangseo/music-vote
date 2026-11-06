"use client";

import { useState, useTransition } from "react";
import Button from "../ui/Button";
import { useDialog } from "../ui/DialogProvider";
import Textarea from "../ui/Textarea";
import { addOrUpdateComment } from "@/actions/comment";
import type { Comment } from "@/domain/types";

interface CommentSectionProps {
  songId: string;
  comments: Comment[];
  nickname: string;
  shareCode: string;
  onCommentsChange: (comments: Comment[]) => void;
  allComments: Comment[];
}

export default function CommentSection({ songId, comments, nickname, shareCode, onCommentsChange, allComments }: CommentSectionProps) {
  const myComment = nickname ? comments.find((c) => c.isMine) : undefined;
  const [content, setContent] = useState(myComment?.content || "");
  const [isEditing, setIsEditing] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showAlert } = useDialog();

  function handleSubmit() {
    if (!nickname || !content.trim() || isPending) return;

    startTransition(async () => {
      try {
        await addOrUpdateComment(songId, content.trim(), shareCode);
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
            isMine: true,
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
        const others = comments.filter((c) => c !== myComment);
        const visible = showAllComments ? others : others.slice(0, 2);
        return (
          <>
            {visible.map((c) => (
              <div key={c.id} className="mb-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-caption font-medium text-primary-fg truncate max-w-30">{c.nickname}</span>
                  <span className="text-caption text-text-subtle">{new Date(c.updated_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className="text-caption text-text-muted whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {others.length > 2 && !showAllComments && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllComments(true)}>
                댓글 {others.length - 2}개 더보기
              </Button>
            )}
          </>
        );
      })()}

      {/* My comment */}
      {nickname && (
        <div className="mt-2">
          {myComment && !isEditing ? (
            <div className="bg-surface-hover/50 rounded-control p-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-caption font-medium text-primary-fg">{nickname} (나)</span>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  수정
                </Button>
              </div>
              <p className="text-caption text-text-muted whitespace-pre-wrap">{myComment.content}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`${nickname}의 메모를 남겨보세요 (1000자)`}
                maxLength={1000}
                rows={2}
              />
              <div className="flex items-center justify-between">
                <span className="text-caption text-text-subtle">{content.length}/1000</span>
                <div className="flex gap-2">
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setContent(myComment?.content || ""); }}>
                      취소
                    </Button>
                  )}
                  <Button variant="tonal" size="sm" onClick={handleSubmit} disabled={!content.trim() || isPending}>
                    {isPending ? "저장 중..." : myComment ? "수정" : "작성"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
