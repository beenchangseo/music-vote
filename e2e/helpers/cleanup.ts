// gstack-shortcut(dec-60acf136): 로컬 게이트 7/10, upgrade when Preview 배포·스테이징 Supabase 도입
//
// The gate runs against the PRODUCTION database, so every spec that writes must
// delete what it wrote, even when it fails. All deletes go through the service
// role and are scoped by (test account id) AND (E2E_PREFIX marker), so nothing
// that belongs to a real user, or to the fixed read-only test room, can match.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./env";

/** Every title / comment the specs create starts with this marker. */
export const E2E_PREFIX = "[e2e]";

/** Reason the service-role client cannot be built, or null when it can. */
export function adminProblem(): string | null {
  loadLocalEnv();
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없어요 (정리 헬퍼가 service_role 이 필요해요)";
}

/** Service-role client. Reads env only; never logs the key. */
export function adminClient(): SupabaseClient {
  const problem = adminProblem();
  if (problem) throw new Error(problem);
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function deleteTestComments(db: SupabaseClient, userIds: string[]): Promise<string[]> {
  const { error } = await db
    .from("comments")
    .delete()
    .in("user_id", userIds)
    .like("content", `${E2E_PREFIX}%`);
  return error ? [`comments: ${error.message}`] : [];
}

async function deleteTestRooms(
  db: SupabaseClient,
  creatorUserIds: string[],
  titleMatch: { eq: string } | { prefix: string },
): Promise<string[]> {
  const query = db.from("playlists").delete().in("creator_user_id", creatorUserIds);
  const { error } = await ("eq" in titleMatch
    ? query.eq("title", titleMatch.eq)
    : query.like("title", `${titleMatch.prefix}%`));
  return error ? [`playlists: ${error.message}`] : [];
}

/**
 * Collects what a spec is about to write and deletes it afterwards.
 * Register BEFORE the write so a failure halfway still gets cleaned up.
 * Playlist deletes cascade to songs, comments, members and the admin token.
 */
export function createCleanup() {
  const rooms: { title: string; creatorUserId: string }[] = [];
  const commentOwners = new Set<string>();

  return {
    /** A room this spec will create. Title must be unique to the run (use E2E_PREFIX + a random suffix). */
    room(title: string, creatorUserId: string): void {
      if (!title.startsWith(E2E_PREFIX)) throw new Error(`test room title must start with ${E2E_PREFIX}`);
      rooms.push({ title, creatorUserId });
    },
    /** This account will write comments whose content starts with E2E_PREFIX. */
    comments(userId: string): void {
      commentOwners.add(userId);
    },
    /** Runs every registered delete. Throws (listing what is left) if any of them failed. */
    async run(): Promise<void> {
      if (rooms.length === 0 && commentOwners.size === 0) return;
      const db = adminClient();
      const failures: string[] = [];
      if (commentOwners.size > 0) failures.push(...(await deleteTestComments(db, [...commentOwners])));
      for (const room of rooms) {
        failures.push(...(await deleteTestRooms(db, [room.creatorUserId], { eq: room.title })));
      }
      if (failures.length > 0) {
        throw new Error(`E2E cleanup failed, remove the [e2e] rows by hand:\n${failures.join("\n")}`);
      }
    },
  };
}

export type Cleanup = ReturnType<typeof createCleanup>;

/**
 * Safety net for runs that were killed before their cleanup could run
 * (Ctrl-C, crash). Deletes every E2E_PREFIX room / comment of the given test accounts.
 */
export async function sweepLeftovers(testUserIds: string[]): Promise<void> {
  if (testUserIds.length === 0) return;
  const db = adminClient();
  const failures = [
    ...(await deleteTestComments(db, testUserIds)),
    ...(await deleteTestRooms(db, testUserIds, { prefix: E2E_PREFIX })),
  ];
  if (failures.length > 0) throw new Error(failures.join("\n"));
}
