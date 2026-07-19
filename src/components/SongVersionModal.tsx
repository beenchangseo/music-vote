"use client";

import { useEffect, useState, useTransition } from "react";
import Modal from "./ui/Modal";
import { useDialog } from "./DialogProvider";
import {
  addSongVersion,
  deleteSongVersion,
  getSongVersions,
  updateSongVersion,
} from "@/actions/song-version";
import type { SongVersion } from "@/lib/types";

interface Props {
  songId: string;
  songTitle: string;
  nickname: string;
  shareCode: string;
  currentUserId?: string | null;
  isAdmin: boolean;
  adminToken: string | null;
  loginGate?: boolean;
  onCountChange?: (count: number) => void;
  onClose: () => void;
}

export default function SongVersionModal(props: Props) {
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showAlert, showConfirm, showDanger } = useDialog();

  useEffect(() => {
    getSongVersions(props.songId)
      .then((rows) => {
        setVersions(rows);
        props.onCountChange?.(rows.length);
      })
      .catch(() => showAlert("다른 버전을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
    // 모달이 열릴 때 한 번만 불러옵니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.songId]);

  function clearForm() {
    setEditingId(null);
    setUrl("");
    setDescription("");
  }

  async function persist(force = false) {
    const result = editingId
      ? await updateSongVersion(editingId, url, description, props.adminToken, props.shareCode, force)
      : await addSongVersion(props.songId, url, description, props.nickname, props.shareCode, force);

    if (!result.success) {
      const duplicate = result.duplicateKind === "original" ? "원곡과 같은 링크예요." : "이미 등록된 다른 버전이에요.";
      const ok = await showConfirm(`${duplicate} 그래도 ${editingId ? "변경" : "추가"}하시겠습니까?`);
      if (ok) await persist(true);
      return;
    }

    const next = editingId
      ? versions.map((item) => item.id === editingId ? result.version : item)
      : [...versions, result.version];
    setVersions(next);
    props.onCountChange?.(next.length);
    clearForm();
  }

  function save() {
    if (!url.trim() || isPending) return;
    startTransition(async () => {
      try {
        await persist();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "저장에 실패했습니다.");
      }
    });
  }

  function canManage(version: SongVersion) {
    return props.isAdmin || (!!props.currentUserId && props.currentUserId === version.added_by_user_id);
  }

  async function remove(version: SongVersion) {
    const ok = await showDanger("이 다른 버전 링크를 삭제하시겠습니까?");
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteSongVersion(version.id, props.adminToken, props.shareCode);
        const next = versions.filter((item) => item.id !== version.id);
        setVersions(next);
        props.onCountChange?.(next.length);
        if (editingId === version.id) clearForm();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
      }
    });
  }

  return (
    <Modal open onClose={props.onClose} title={`다른 버전 · ${props.songTitle}`}>
      <div className="space-y-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">불러오는 중...</p>
        ) : versions.length === 0 ? (
          <p className="py-5 text-center text-sm text-text-muted">아직 등록된 다른 버전이 없어요.</p>
        ) : versions.map((version) => (
          <div key={version.id} className="rounded-xl border border-border bg-surface p-3">
            <a href={version.youtube_url} target="_blank" rel="noreferrer" className="block text-sm font-medium text-text hover:text-primary line-clamp-2">
              {version.title}
            </a>
            {version.description && <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">{version.description}</p>}
            <div className="mt-2 flex items-center justify-between gap-2 text-caption text-text-subtle">
              <span className="truncate">추가: {version.added_by_nickname}</span>
              {canManage(version) && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="min-h-11 px-3 hover:text-text" onClick={() => { setEditingId(version.id); setUrl(version.youtube_url); setDescription(version.description || ""); }}>수정</button>
                  <button type="button" className="min-h-11 px-3 hover:text-danger" onClick={() => remove(version)}>삭제</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!props.loginGate && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-text">{editingId ? "다른 버전 수정" : "다른 버전 추가"}</p>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube 링크" className="h-11 w-full rounded-xl border border-border bg-surface-hover px-3 text-sm text-text" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} rows={2} placeholder="짧은 설명 (선택)" className="w-full resize-none rounded-xl border border-border bg-surface-hover px-3 py-2 text-sm text-text" />
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-subtle">{description.length}/100</span>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={clearForm} className="min-h-11 px-4 text-sm text-text-muted">취소</button>}
              <button type="button" onClick={save} disabled={!url.trim() || isPending} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{isPending ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
