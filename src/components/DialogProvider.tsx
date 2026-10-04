"use client";

import { createContext, useContext, useState, useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { trapTabKey } from "./ui/focus-trap";

interface DialogButton {
  label: string;
  variant?: "primary" | "danger" | "ghost";
  onClick?: () => void | Promise<void>;
}

interface DialogState {
  title: string;
  message: string;
  buttons: DialogButton[];
  /** Index of the button that gets focus on open. Danger dialogs start on 취소. */
  focusIndex: number;
}

/** Optional second argument. A plain string is still read as the title. */
export interface DialogOptions {
  title?: string;
  confirmLabel?: string;
}

interface DialogContextType {
  showAlert: (message: string, options?: string | DialogOptions) => Promise<void>;
  showConfirm: (message: string, options?: string | DialogOptions) => Promise<boolean>;
  showDanger: (message: string, options?: string | DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used inside DialogProvider");
  return ctx;
}

const buttonStyles = {
  primary: "bg-primary hover:bg-primary-hover text-white font-semibold",
  danger: "bg-red-600 hover:bg-red-500 text-white font-semibold",
  ghost: "bg-surface-hover hover:bg-border-strong text-text-muted font-medium",
};

function resolveOptions(options: string | DialogOptions | undefined, title: string, confirmLabel: string) {
  const opts = typeof options === "string" ? { title: options } : options ?? {};
  return { title: opts.title ?? title, confirmLabel: opts.confirmLabel ?? confirmLabel };
}

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [resolveRef, setResolveRef] = useState<{ resolve: (v: boolean) => void } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const titleId = useId();
  const messageId = useId();

  const close = useCallback((result: boolean) => {
    resolveRef?.resolve(result);
    setDialog(null);
    setResolveRef(null);
  }, [resolveRef]);

  const showAlert = useCallback((message: string, options?: string | DialogOptions) => {
    const { title, confirmLabel } = resolveOptions(options, "알림", "확인");
    return new Promise<void>((resolve) => {
      setResolveRef({ resolve: () => resolve() });
      setDialog({
        title,
        message,
        buttons: [{ label: confirmLabel, variant: "primary" }],
        focusIndex: 0,
      });
    });
  }, []);

  const showConfirm = useCallback((message: string, options?: string | DialogOptions) => {
    const { title, confirmLabel } = resolveOptions(options, "확인", "확인");
    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
      setDialog({
        title,
        message,
        buttons: [
          { label: "취소", variant: "ghost" },
          { label: confirmLabel, variant: "primary" },
        ],
        focusIndex: 1,
      });
    });
  }, []);

  const showDanger = useCallback((message: string, options?: string | DialogOptions) => {
    const { title, confirmLabel } = resolveOptions(options, "삭제 확인", "삭제");
    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
      setDialog({
        title,
        message,
        buttons: [
          { label: "취소", variant: "ghost" },
          { label: confirmLabel, variant: "danger" },
        ],
        // An irreversible action must not run on a stray Enter.
        focusIndex: 0,
      });
    });
  }, []);

  // While open: first focus, Tab cycle, ESC = cancel, then restore focus on close.
  useEffect(() => {
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttonRefs.current[dialog.focusIndex]?.focus();

    const onKey = (e: KeyboardEvent) => {
      // preventDefault tells a Modal underneath that this key is taken.
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Tab" && panelRef.current) {
        trapTabKey(e, panelRef.current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [dialog, close]);

  return (
    <DialogContext value={{ showAlert, showConfirm, showDanger }}>
      {children}

      {dialog && (
        <div
          data-dialog-layer
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 animate-fade-in"
        >
          <div ref={panelRef} className="w-full max-w-xs bg-surface border border-border rounded-2xl p-5 animate-slide-up shadow-2xl">
            <h3 id={titleId} className="text-base font-bold text-text text-center">{dialog.title}</h3>
            <p id={messageId} className="text-sm text-text-muted text-center mt-2 whitespace-pre-wrap leading-relaxed">{dialog.message}</p>
            <div className={`mt-5 flex gap-2 ${dialog.buttons.length === 1 ? "" : ""}`}>
              {dialog.buttons.map((btn, i) => {
                const isLast = i === dialog.buttons.length - 1;
                return (
                  <button
                    key={i}
                    ref={(el) => {
                      buttonRefs.current[i] = el;
                    }}
                    onClick={() => close(isLast)}
                    className={`flex-1 h-11 rounded-xl text-sm transition-all active:scale-95 ${buttonStyles[btn.variant || "ghost"]}`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </DialogContext>
  );
}
