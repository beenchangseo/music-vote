"use client";

import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

/**
 * Trigger Kakao OAuth from anywhere in the client.
 * Redirects to /auth/callback then back to `next` (defaults to current URL).
 */
export async function triggerKakaoLogin(next?: string) {
  track("auth_login_start", { provider: "kakao" });
  const supabase = createClient();
  const target = next || `${window.location.pathname}${window.location.search}`;
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo },
  });
  if (error) {
    alert("로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
  }
}
