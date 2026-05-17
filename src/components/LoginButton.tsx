"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

type Props = {
  next?: string;
  className?: string;
  label?: string;
  size?: "sm" | "md";
};

export default function LoginButton({ next, className, label = "카카오로 시작하기", size = "md" }: Props) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    track("auth_login_start", { provider: "kakao" });

    const supabase = createClient();
    const fallbackNext = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || fallbackNext)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo },
    });
    if (error) {
      setLoading(false);
      alert("로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const sizeCls = size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-body";

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className={
        className ||
        `inline-flex items-center justify-center gap-2 ${sizeCls} rounded-lg bg-[#FEE500] text-[#191919] font-semibold hover:brightness-95 active:brightness-90 disabled:opacity-60 transition`
      }
    >
      <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden>
        <path
          fill="currentColor"
          d="M10 3.2c-4.4 0-8 2.8-8 6.3 0 2.3 1.5 4.3 3.8 5.4l-.9 3.3c-.1.3.2.5.5.4l3.9-2.6c.2 0 .5 0 .7 0 4.4 0 8-2.8 8-6.3S14.4 3.2 10 3.2z"
        />
      </svg>
      {loading ? "이동 중…" : label}
    </button>
  );
}
