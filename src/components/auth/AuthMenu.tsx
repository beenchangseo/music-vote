"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Avatar from "../ui/Avatar";

interface AuthMenuProps {
  nickname: string;
  avatarUrl: string | null;
  /** PlaylistHeader 내부 등 명시적 배치 시 true. fixed 글로벌 슬롯과 별개. */
  embedded?: boolean;
}

export default function AuthMenu({ nickname, avatarUrl, embedded = false }: AuthMenuProps) {
  const pathname = usePathname();
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

  // 플리 페이지는 PlaylistHeader 가 embedded AuthMenu 를 자체 렌더 → 글로벌 fixed 슬롯은 숨김.
  // (early return 은 모든 훅 호출 뒤에 — rules-of-hooks 준수)
  if (!embedded && pathname?.startsWith("/playlist/")) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${nickname} 계정 메뉴`}
        aria-expanded={open}
        className="group block rounded-pill"
      >
        <Avatar name={nickname} src={avatarUrl} size="md" className="ring-1 ring-border transition-shadow group-hover:ring-border-strong" />
      </button>

      {open && (
        // z-40: the playlist header renders this menu embedded (outside the fixed z-50 slot), and the
        // cover below it is positioned, so without a z-index the cover painted over the menu. Below sheets (z-[90]).
        <div className="absolute right-0 top-11 z-40 w-44 rounded-control border border-border bg-surface shadow-float animate-fade-in overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-caption text-text-subtle">로그인됨</p>
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
