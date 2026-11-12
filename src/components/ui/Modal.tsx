"use client";

import { ReactNode, RefObject, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { dialogLayerOpen, getFocusable, trapTabKey } from "./focus-trap";
import IconButton from "./IconButton";
import { CloseIcon } from "./icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /**
   * One line under the title, read out as the dialog's description. It sits in
   * the fixed header, so the body's scroll box never clips it.
   */
  description?: string;
  /**
   * Element that receives focus when the sheet opens. Without it the first
   * focusable element in `children` gets focus (the header close button is
   * skipped). Use this instead of `autoFocus` so focus restore keeps working.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * Bottom area that stays put while the body scrolls (the comment input).
   * A divider sits above it, and it takes the bottom safe-area padding.
   */
  footer?: ReactNode;
}

const safeBottom = "pb-[calc(1.25rem+var(--spacing-safe-bottom))]";

export default function Modal({ open, onClose, children, title, description, initialFocus, footer }: ModalProps) {
  const descriptionId = useId();
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
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden bg-surface rounded-t-sheet sm:max-w-md sm:rounded-sheet animate-slide-up shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pb-3 pt-2 sm:pt-5">
          <div aria-hidden className="mx-auto mb-2 h-1 w-9 rounded-pill bg-border-strong sm:hidden" />
          <div className="flex items-center justify-between">
            {title ? <h2 className="text-h3 font-bold text-text">{title}</h2> : <span />}
            <IconButton ref={closeRef} bare onClick={onClose} aria-label="닫기" className="-mr-2">
              <CloseIcon className="size-5" />
            </IconButton>
          </div>
          {description && (
            <p id={descriptionId} className="mt-1 text-sm text-text-muted">
              {description}
            </p>
          )}
        </div>
        {/* pt-1: room for the first child's focus ring, which the scroll box would clip. */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pt-1 ${footer ? "pb-4" : safeBottom}`}>{children}</div>
        {footer && <div className={`shrink-0 border-t border-border px-5 pt-4 ${safeBottom}`}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
