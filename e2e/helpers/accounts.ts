import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ACCOUNTS = ["account-a", "account-b"] as const;
export type AccountName = (typeof ACCOUNTS)[number];

export function isAccountName(value: string): value is AccountName {
  return (ACCOUNTS as readonly string[]).includes(value);
}

export function authStatePath(account: AccountName): string {
  return resolve(process.cwd(), "e2e/.auth", `${account}.json`);
}

export function hasAuthState(account: AccountName): boolean {
  return existsSync(authStatePath(account));
}

interface StoredState {
  cookies?: { name: string; value: string }[];
}

// Supabase SSR cookie: `sb-<ref>-auth-token`, split into `.0`, `.1`, ... chunks when long.
const SESSION_COOKIE = /^(sb-.+-auth-token)(?:\.(\d+))?$/;

/**
 * Supabase user id of a saved login, decoded from the session cookie of a
 * storageState object. null when the state holds no usable session.
 */
export function userIdFromState(state: StoredState): string | null {
  const parts = new Map<string, string[]>();
  for (const { name, value } of state.cookies ?? []) {
    const match = SESSION_COOKIE.exec(name);
    if (!match) continue;
    const chunks = parts.get(match[1]) ?? [];
    chunks[match[2] ? Number(match[2]) : 0] = value;
    parts.set(match[1], chunks);
  }

  for (const chunks of parts.values()) {
    try {
      let raw = decodeURIComponent(chunks.join(""));
      if (raw.startsWith("base64-")) {
        raw = Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8");
      }
      const session = JSON.parse(raw) as { user?: { id?: string } };
      if (session.user?.id) return session.user.id;
    } catch {
      // Not a session cookie we can read; try the next one.
    }
  }
  return null;
}

/** Supabase user id of the saved login, or null when the file is missing or has no session. */
export function readAccountUserId(account: AccountName): string | null {
  if (!hasAuthState(account)) return null;
  try {
    return userIdFromState(JSON.parse(readFileSync(authStatePath(account), "utf8")) as StoredState);
  } catch {
    return null;
  }
}
