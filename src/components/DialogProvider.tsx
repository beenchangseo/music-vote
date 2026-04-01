"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface DialogButton {
  label: string;
  variant?: "primary" | "danger" | "ghost";
  onClick?: () => void | Promise<void>;
}

interface DialogState {
  title: string;
  message: string;
  buttons: DialogButton[];
}

interface DialogContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showDanger: (message: string, title?: string) => Promise<boolean>;
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
  ghost: "bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium",
};

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [resolveRef, setResolveRef] = useState<{ resolve: (v: boolean) => void } | null>(null);

  const close = useCallback((result: boolean) => {
    resolveRef?.resolve(result);
    setDialog(null);
    setResolveRef(null);
  }, [resolveRef]);

  const showAlert = useCallback((message: string, title = "알림") => {
    return new Promise<void>((resolve) => {
      setResolveRef({ resolve: () => resolve() });
      setDialog({
        title,
        message,
        buttons: [{ label: "확인", variant: "primary" }],
      });
    });
  }, []);

  const showConfirm = useCallback((message: string, title = "확인") => {
    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
      setDialog({
        title,
        message,
        buttons: [
          { label: "취소", variant: "ghost" },
          { label: "확인", variant: "primary" },
        ],
      });
    });
  }, []);

  const showDanger = useCallback((message: string, title = "삭제 확인") => {
    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
      setDialog({
        title,
        message,
        buttons: [
          { label: "취소", variant: "ghost" },
          { label: "삭제", variant: "danger" },
        ],
      });
    });
  }, []);

  return (
    <DialogContext value={{ showAlert, showConfirm, showDanger }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4 animate-fade-in">
          <div className="w-full max-w-xs bg-gray-900 border border-border rounded-2xl p-5 animate-slide-up shadow-2xl">
            <h3 className="text-base font-bold text-gray-100 text-center">{dialog.title}</h3>
            <p className="text-sm text-gray-300 text-center mt-2 whitespace-pre-wrap leading-relaxed">{dialog.message}</p>
            <div className={`mt-5 flex gap-2 ${dialog.buttons.length === 1 ? "" : ""}`}>
              {dialog.buttons.map((btn, i) => {
                const isLast = i === dialog.buttons.length - 1;
                return (
                  <button
                    key={btn.label}
                    onClick={() => close(isLast)}
                    className={`flex-1 py-2.5 rounded-xl text-sm transition-all active:scale-95 ${buttonStyles[btn.variant || "ghost"]}`}
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
