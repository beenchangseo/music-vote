"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import Button from "../ui/Button";

type Props = {
  next?: string;
  className?: string;
  label?: string;
  /** tonal: 화면에 카카오 노랑이 이미 있을 때 조용한 로그인. */
  variant?: "kakao" | "tonal";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export default function LoginButton({ next, className, label = "카카오로 시작하기", variant = "kakao", size = "md", fullWidth = false }: Props) {
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

  return (
    <Button type="button" variant={variant} size={size} fullWidth={fullWidth} loading={loading} onClick={handleLogin} className={className}>
      {loading ? "이동 중…" : label}
    </Button>
  );
}
