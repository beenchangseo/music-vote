"use client";

import { useEffect, useState, useTransition } from "react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import EmptyState from "../ui/EmptyState";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { useDialog } from "../ui/DialogProvider";
import {
  addSongVersion,
  deleteSongVersion,
  getSongVersions,
  updateSongVersion,
} from "@/actions/song-version";
import type { SongVersion } from "@/domain/types";

interface Props {
  songId: string;
  songTitle: string;
  shareCode: string;
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
      .catch(() => showAlert("다른 버전을 불러오지 못했어요"))
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
      ? await updateSongVersion(editingId, url, description, props.shareCode, force)
      : await addSongVersion(props.songId, url, description, props.shareCode, force);

    if (!result.success) {
      const duplicate = result.duplicateKind === "original" ? "원곡과 같은 링크예요." : "이미 등록된 다른 버전이에요.";
      const ok = await showConfirm(`${duplicate} 그래도 ${editingId ? "변경" : "추가"}할까요?`);
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
        showAlert(error instanceof Error ? error.message : "저장하지 못했어요");
      }
    });
  }

  async function remove(version: SongVersion) {
    const ok = await showDanger("이 다른 버전 링크를 삭제할까요?");
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteSongVersion(version.id, props.shareCode);
        const next = versions.filter((item) => item.id !== version.id);
        setVersions(next);
        props.onCountChange?.(next.length);
        if (editingId === version.id) clearForm();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "삭제하지 못했어요");
      }
    });
  }

  return (
    <Modal open onClose={props.onClose} title={`다른 버전 · ${props.songTitle}`}>
      <div className="space-y-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
        ) : versions.length === 0 ? (
          <EmptyState size="inline" description="아직 등록된 다른 버전이 없어요." />
        ) : versions.map((version) => (
          <div key={version.id} className="rounded-card border border-border bg-surface-hover p-3">
            <a href={version.youtube_url} target="_blank" rel="noreferrer" className="block text-sm font-medium text-text hover:text-primary-fg line-clamp-2">
              {version.title}
            </a>
            {version.description && <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">{version.description}</p>}
            <div className="mt-2 flex items-center justify-between gap-2 text-caption text-text-subtle">
              <span className="truncate">추가: {version.added_by_nickname}</span>
              {version.canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingId(version.id); setUrl(version.youtube_url); setDescription(version.description || ""); }}>
                    수정
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(version)}>
                    삭제
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!props.loginGate && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-text">{editingId ? "다른 버전 수정" : "다른 버전 추가"}</p>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube 링크" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} rows={2} placeholder="짧은 설명 (선택)" />
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-subtle">{description.length}/100</span>
            <div className="flex gap-2">
              {editingId && (
                <Button variant="ghost" onClick={clearForm}>
                  취소
                </Button>
              )}
              <Button onClick={save} disabled={!url.trim()} loading={isPending}>
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
