import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { devices, expect, test as base, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { authStatePath, isAccountName, userIdFromState, type AccountName } from "./helpers/accounts";
import { createCleanup, type Cleanup } from "./helpers/cleanup";

export { expect };

/** Writes the refreshed login of `context` back to the account's state file (see `context` below). */
async function saveRefreshedState(context: BrowserContext, account: AccountName): Promise<void> {
  if (!existsSync(authStatePath(account))) return;
  const state = await context.storageState();
  if (!userIdFromState(state)) {
    console.warn(`[e2e] ${account}: 세션 쿠키가 없어 저장된 로그인 상태를 덮어쓰지 않았어요 (로그인이 풀렸을 수 있어요)`);
    return;
  }
  const path = authStatePath(account);
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

/**
 * Runs `fn` with a page logged in as another test account (two-account band flows).
 * Never call it for the account the current project already runs as, and never nest two
 * calls for the same account: two live contexts on one login trip Supabase reuse detection.
 * The refreshed login is written back before the context closes.
 */
export async function withAccountPage<T>(
  // A context made by hand inherits the project's `use` (storageState included), so the
  // account's state is always set explicitly; baseURL is passed along to keep that visible.
  { browser, baseURL }: { browser: Browser; baseURL: string | undefined },
  account: AccountName,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL,
    storageState: authStatePath(account),
  });
  try {
    return await fn(await context.newPage());
  } finally {
    await saveRefreshedState(context, account);
    await context.close();
  }
}

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
    if (!isAccountName(account)) return;
    await saveRefreshedState(context, account);
  },
});

/** Fails if the app showed its generic alert dialog ("알림"), which every failed server action opens. */
export async function expectNoAlert(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "알림", level: 3 })).toHaveCount(0);
}
