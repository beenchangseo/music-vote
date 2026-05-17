"use client";

import { useRef, useState, useTransition } from "react";
import { uploadSetlistPoster, removeSetlistPoster } from "@/actions/playlist";
import { useDialog } from "./DialogProvider";

interface PosterUploadButtonProps {
  playlistId: string;
  adminToken: string | null;
  shareCode: string;
  hasPoster: boolean;
}

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export default function PosterUploadButton({
  playlistId,
  adminToken,
  shareCode,
  hasPoster,
}: PosterUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const { showAlert, showDanger } = useDialog();

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      const blob = new File([resized], "poster.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("poster", blob);
      startTransition(async () => {
        try {
          await uploadSetlistPoster(playlistId, adminToken, fd, shareCode);
        } catch (err) {
          showAlert(err instanceof Error ? err.message : "업로드에 실패했어요.");
        } finally {
          setBusy(false);
        }
      });
    } catch {
      setBusy(false);
      showAlert("이미지 처리에 실패했어요.");
    }
  }

  async function handleRemove() {
    const ok = await showDanger("공연 포스터를 삭제할까요?");
    if (!ok) return;
    startTransition(async () => {
      try {
        await removeSetlistPoster(playlistId, adminToken, shareCode);
      } catch (err) {
        showAlert(err instanceof Error ? err.message : "삭제에 실패했어요.");
      }
    });
  }

  const loading = busy || isPending;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // 같은 파일 재선택 허용
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => (hasPoster ? handleRemove() : inputRef.current?.click())}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg text-caption font-semibold transition-colors disabled:opacity-50 ${
          hasPoster
            ? "bg-primary/15 border border-primary/40 text-primary hover:bg-primary/20"
            : "bg-surface-hover hover:bg-border-strong text-text-muted hover:text-text"
        }`}
        aria-label={hasPoster ? "공연 포스터 삭제" : "공연 포스터 등록"}
        title={hasPoster ? "공연 포스터 (탭하여 삭제)" : "이미지 업로드"}
      >
        {loading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <PosterIcon />
        )}
        {hasPoster ? "포스터 변경" : "공연 포스터 등록"}
      </button>
      {hasPoster && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="hidden"
          aria-hidden
        />
      )}
    </>
  );
}

function PosterIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}
