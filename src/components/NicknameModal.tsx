"use client";

import { useState, useEffect, useRef } from "react";

interface NicknameModalProps {
  onSubmit: (nickname: string) => void;
}

export default function NicknameModal({ onSubmit }: NicknameModalProps) {
  const [nickname, setNickname] = useState("");
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nickname");
    if (saved) {
      onSubmit(saved);
    } else {
      setShow(true);
    }
    setChecked(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect mobile keyboard via visualViewport API
  useEffect(() => {
    if (!show) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      if (!vv) return;
      // Keyboard is likely open when viewport height is significantly less than window height
      const isKeyboard = vv.height < window.innerHeight * 0.75;
      setKeyboardVisible(isKeyboard);

      // Scroll the modal into view when keyboard opens
      if (isKeyboard && containerRef.current) {
        containerRef.current.style.transform = `translateY(${Math.max(0, vv.offsetTop)}px)`;
      } else if (containerRef.current) {
        containerRef.current.style.transform = "";
      }
    }

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [show]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    const trimmed = nickname.trim();
    try { localStorage.setItem("nickname", trimmed); } catch { /* quota */ }
    setShow(false);
    onSubmit(trimmed);
  }

  if (!checked || !show) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm transition-all duration-200 ${
        keyboardVisible ? "items-start pt-[15vh]" : "items-end sm:items-center"
      }`}
    >
      <div className={`w-full max-w-sm mx-4 bg-surface p-6 animate-slide-up ${
        keyboardVisible ? "rounded-2xl mb-0" : "rounded-t-2xl sm:rounded-2xl mb-0"
      }`}>
        <h2 className="text-xl font-bold text-center mb-2">환영합니다!</h2>
        <p className="text-gray-400 text-center text-sm mb-6">
          투표에 참여할 닉네임을 입력해주세요
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={20}
            autoFocus
            enterKeyHint="done"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-border text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg"
          />
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            시작하기
          </button>
        </form>
      </div>
    </div>
  );
}
