import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

function extractNickname(user: User): string {
  const meta = user.user_metadata ?? {};
  return (
    meta.preferred_username ||
    meta.user_name ||
    meta.nickname ||
    meta.name ||
    meta.full_name ||
    user.email?.split("@")[0] ||
    "사용자"
  );
}

function extractAvatar(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return meta.avatar_url || meta.picture || null;
}

// One Supabase Auth call per request: the home page and its loaders all ask (eng E4).
// React cache is scoped to a single server request, so users never share a result.
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    nickname: extractNickname(user),
    avatarUrl: extractAvatar(user),
  };
});

// @supabase/ssr stores the session as sb-<project-ref>-auth-token, split into .0 / .1 when large.
// The OAuth "-code-verifier" cookie is not a session.
const SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Whether a Supabase login cookie is present, read without a network call. The home uses it to send
 * its skeleton before the real check (eng O4). A stale cookie still fails the real check later.
 */
export function hasAuthCookie(cookieNames: Iterable<string>): boolean {
  for (const name of cookieNames) if (SUPABASE_AUTH_COOKIE.test(name)) return true;
  return false;
}
