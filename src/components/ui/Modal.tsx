"use client";

import { ReactNode, RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { dialogLayerOpen, getFocusable, trapTabKey } from "./focus-trap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /**
   * Element that receives focus when the sheet opens. Without it the first
   * focusable element in `children` gets focus (the header close button is
   * skipped). Use this instead of `autoFocus` so focus restore keeps working.
   */
  initialFocus?: RefObject<HTMLElement | null>;
}

export default function Modal({ open, onClose, children, title, initialFocus }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // defaultPrevented: the confirm layer already handled this key and may
      // have unmounted before this listener runs.
      if (e.defaultPrevented || dialogLayerOpen()) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "Tab" && panelRef.current) trapTabKey(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Move focus into the sheet on open and hand it back to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const target =
      initialFocus?.current ??
      (panel ? getFocusable(panel).find((el) => el !== closeRef.current) : undefined) ??
      closeRef.current;
    target?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, initialFocus]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full sm:max-w-md bg-bg border-t sm:border border-border rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          {title ? (
            <h2 className="text-h3 font-bold text-text">{title}</h2>
          ) : (
            <span />
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            aria-label="닫기"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
