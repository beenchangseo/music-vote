"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-full px-4 animate-fade-in">
      <div className="bg-gray-800 border border-border rounded-xl px-4 py-3 shadow-lg">
        <p className="text-sm text-gray-100 whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}
