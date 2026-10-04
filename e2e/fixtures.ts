import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";
import { authStatePath, isAccountName, userIdFromState } from "./helpers/accounts";
import { createCleanup, type Cleanup } from "./helpers/cleanup";

export { expect };

/**
 * Skips the surrounding describe (or test) with a visible reason when a
 * prerequisite is missing, so `npm run test:e2e` still runs everything else.
 */
export function skipWhen(...problems: (string | null)[]): void {
  const problem = problems.find((p) => p !== null) ?? null;
  base.skip(problem !== null, problem ?? "");
}

export const test = base.extend<{ cleanup: Cleanup }>({
  // Deletes what the spec wrote. Fixture teardown runs on failure and timeout too,
  // and a cleanup error is reported as an extra failure next to the original one.
  cleanup: async ({}, provide) => {
    const cleanup = createCleanup();
    try {
      await provide(cleanup);
    } finally {
      await cleanup.run();
    }
  },

  // The proxy refreshes Supabase tokens on every request and refresh tokens are
  // single-use, so the saved login would die after the first expiry. Write the
  // refreshed cookies back to the same file once the test is done.
  // Overriding `context` (instead of an auto fixture) keeps request-only specs browser-free.
  context: async ({ context }, provide, testInfo) => {
    await provide(context);
    const account = testInfo.project.name;
    if (!isAccountName(account) || !existsSync(authStatePath(account))) return;

    const state = await context.storageState();
    if (!userIdFromState(state)) {
      console.warn(`[e2e] ${account}: 세션 쿠키가 없어 저장된 로그인 상태를 덮어쓰지 않았어요 (로그인이 풀렸을 수 있어요)`);
      return;
    }
    const path = authStatePath(account);
    writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);
  },
});

/** Fails if the app showed its generic alert dialog ("알림"), which every failed server action opens. */
export async function expectNoAlert(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "알림", level: 3 })).toHaveCount(0);
}
