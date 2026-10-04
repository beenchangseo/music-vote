// gstack-shortcut(dec-60acf136): 로컬 게이트 7/10, upgrade when Preview 배포·스테이징 Supabase 도입
//
// Local pre-deploy gate: `next dev` against the PRODUCTION Supabase, logged in with
// saved storageState of two dedicated Kakao test accounts. There is no CI, no Preview
// deploy and no staging DB. See e2e/README.md.
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { authStatePath, type AccountName } from "./e2e/helpers/accounts";
import { loadLocalEnv } from "./e2e/helpers/env";

// Specs and the cleanup helper read E2E_* and the service-role key from here.
loadLocalEnv();

const BASE_URL = "http://localhost:3000";

// A missing login file must not crash the run: start the project logged out and let
// its specs skip themselves with a message (see e2e/helpers/guards.ts).
function accountProject(account: AccountName) {
  const storageState = authStatePath(account);
  return {
    name: account,
    testMatch: `**/${account}/**/*.spec.ts`,
    use: { ...devices["Pixel 7"], ...(existsSync(storageState) ? { storageState } : {}) },
  };
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  // One worker, no parallelism: Supabase refresh-token reuse detection revokes the whole
  // token family when two contexts use the same account's state at once.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,

  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    navigationTimeout: 45_000, // first `next dev` compile of a route is slow
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },

  projects: [
    {
      name: "anon",
      testMatch: "**/anon/**/*.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
    accountProject("account-a"),
    accountProject("account-b"),
  ],
});
