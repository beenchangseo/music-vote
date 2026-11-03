import { createHmac } from "node:crypto";
import type { MemberKey } from "@/domain/types";

/** Where a key is valid. A key made for one playlist or band names nobody in another. */
export type MemberScope = { playlistId: string } | { teamId: string };

/**
 * The key the screen gets for `userId` in `scope`. The same member keeps the same key across reads,
 * so a list read again after a save keeps its rows and staged inputs.
 * Keyed with the server secret so that holding an account id is not enough to compute or confirm a key.
 */
export function memberKeyFor(scope: MemberScope, userId: string): MemberKey {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const where = "playlistId" in scope ? `playlist:${scope.playlistId}` : `team:${scope.teamId}`;
  return createHmac("sha256", secret)
    .update(`plypick/member-key/v1\n${where}\n${userId}`)
    .digest()
    .subarray(0, 16)
    .toString("base64url") as MemberKey;
}

/**
 * The scope's members, just read by a write path, indexed by key. A miss means the key names nobody here now
 * (left since the screen loaded, made for another scope, forged, or an account id from an old tab);
 * callers refuse the whole write on a miss.
 */
export function membersByKey<M extends { user_id: string }>(
  scope: MemberScope,
  members: readonly M[],
): ReadonlyMap<MemberKey, M> {
  return new Map(members.map((member) => [memberKeyFor(scope, member.user_id), member]));
}
