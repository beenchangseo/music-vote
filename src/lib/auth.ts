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

export async function getCurrentUser(): Promise<AuthUser | null> {
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
}
