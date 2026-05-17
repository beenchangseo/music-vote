"use client";

import { useState } from "react";
import Image from "next/image";

interface PosterPolaroidProps {
  posterUrl: string;
  /** 합주실 게시판 메타포 — 살짝 틀어진 각도 */
  rotation?: number;
}

export default function PosterPolaroid({
  posterUrl,
  rotation = -2,
}: PosterPolaroidProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="공연 포스터 크게 보기"
        className="group block shrink-0 transition-transform hover:-rotate-0 hover:scale-105 active:scale-95"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-md bg-white p-1 pb-3 shadow-[0_6px_16px_rgba(0,0,0,0.5)] ring-1 ring-black/20">
          <div className="relative w-full h-full overflow-hidden rounded-sm">
            <Image
              src={posterUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className="object-cover"
            />
          </div>
          {/* 압정 (게시판 메타포) */}
          <span
            aria-hidden
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-danger shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          />
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="공연 포스터"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label="닫기"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface/80 backdrop-blur text-text hover:bg-surface flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative max-w-[min(92vw,560px)] max-h-[88vh] aspect-[3/4] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={posterUrl}
              alt="공연 포스터"
              fill
              sizes="(max-width: 640px) 92vw, 560px"
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}
    </>
  );
}
