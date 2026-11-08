"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Button from "../ui/Button";
import { useDialog } from "../ui/DialogProvider";
import EmptyState from "../ui/EmptyState";
import Modal from "../ui/Modal";
import Textarea from "../ui/Textarea";
import { addOrUpdateComment, deleteComment, getCommentsBySong } from "@/actions/comment";
import type { Comment } from "@/domain/types";
import LoginButton from "../auth/LoginButton";

interface CommentModalProps {
  songId: string;
  songTitle: string;
  nickname: string;
  shareCode: string;
  onClose: () => void;
  loginGate?: boolean;
}

export default function CommentModal({ songId, songTitle, nickname, shareCode, onClose, loginGate = false }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showAlert, showDanger } = useDialog();
  const listRef = useRef<HTMLDivElement>(null);

  const myComment = nickname ? comments.find((c) => c.isMine) : undefined;

  // Load comments on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getCommentsBySong(songId);
        setComments(data);
        const mine = data.find((c) => c.isMine);
        if (mine) setContent(mine.content);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [songId, nickname]);

  function handleSubmit() {
    if (!nickname || !content.trim() || isPending) return;

    startTransition(async () => {
      try {
        await addOrUpdateComment(songId, content.trim(), shareCode);
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
        await deleteComment(songId, shareCode);
        setComments((prev) => prev.filter((c) => !c.isMine));
        setContent("");
        setIsEditing(false);
      } catch {
        showAlert("댓글 삭제에 실패했습니다.");
      }
    });
  }

  const otherComments = comments.filter((c) => c !== myComment);

  let footer: ReactNode = null;
  if (loginGate) {
    footer = (
      <div className="text-center">
        <p className="mb-2 text-caption text-text-subtle">댓글을 남기려면 로그인이 필요해요</p>
        <LoginButton size="sm" />
      </div>
    );
  } else if (!nickname) {
    footer = <p className="text-center text-caption text-text-subtle">보관된 플레이리스트라 댓글을 새로 남길 수 없어요</p>;
  } else if (!myComment || isEditing) {
    footer = (
      <>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`${nickname}의 메모를 남겨보세요`}
          maxLength={1000}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-caption text-text-subtle">{content.length}/1000</span>
          <div className="flex gap-2">
            {isEditing && (
              <Button variant="ghost" onClick={() => { setIsEditing(false); setContent(myComment?.content || ""); }}>
                취소
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={!content.trim()} loading={isPending}>
              {myComment ? "수정" : "작성"}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    // Focus the list, not the textarea: opening the sheet to read should not raise the keyboard.
    <Modal open onClose={onClose} title={`댓글 · ${songTitle}`} initialFocus={listRef} footer={footer}>
      <div ref={listRef} tabIndex={-1} className="space-y-3">
        {loading ? (
          <div className="py-8 text-center">
            <span className="inline-block size-6 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
          </div>
        ) : comments.length === 0 && !nickname ? (
          <EmptyState size="inline" description="아직 댓글이 없어요" />
        ) : (
          <>
            {otherComments.map((c) => (
              <div key={c.id} className="rounded-control bg-surface-hover/50 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-caption font-medium text-primary-fg">{c.nickname}</span>
                  <span className="text-caption text-text-subtle">
                    {new Date(c.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{c.content}</p>
              </div>
            ))}

            {myComment && !isEditing && (
              <div className="rounded-control border border-primary/20 bg-primary/5 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-caption font-medium text-primary-fg">{nickname} (나)</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(true); setContent(myComment.content); }}>
                      수정
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDelete}>
                      삭제
                    </Button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{myComment.content}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
