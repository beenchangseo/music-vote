"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface AuthMenuProps {
  nickname: string;
  avatarUrl: string | null;
  /** PlaylistHeader 내부 등 명시적 배치 시 true. fixed 글로벌 슬롯과 별개. */
  embedded?: boolean;
}

export default function AuthMenu({ nickname, avatarUrl, embedded = false }: AuthMenuProps) {
  const pathname = usePathname();
  // 플리 페이지는 PlaylistHeader 가 embedded AuthMenu 를 자체 렌더 → 글로벌 fixed 슬롯은 숨김
  if (!embedded && pathname?.startsWith("/playlist/")) return null;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${nickname} 계정 메뉴`}
        aria-expanded={open}
        className="block w-9 h-9 rounded-full overflow-hidden border border-border bg-surface hover:border-border-strong transition-colors"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="flex w-full h-full items-center justify-center bg-primary/20 text-primary text-sm font-semibold">
            {nickname.slice(0, 1)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-44 rounded-xl border border-border bg-surface shadow-lg animate-fade-in overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs text-text-subtle">로그인됨</p>
            <p className="text-sm font-medium text-text truncate">{nickname}</p>
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="w-full text-left px-3 py-2.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
