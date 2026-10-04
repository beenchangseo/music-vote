// Saves the Kakao login state of a dedicated test account for the Playwright gate.
//
//   npm run dev                        # terminal 1 (the login callback needs the app)
//   npm run e2e:auth -- account-a      # terminal 2: log in by hand, then press Enter
//
// Run with Node's built-in TypeScript support (Node 22.18+), so it has no extra dependency.
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const ACCOUNTS = ["account-a", "account-b"];

const account = process.argv[2];
if (!account || !ACCOUNTS.includes(account)) {
  console.error(`usage: npm run e2e:auth -- <${ACCOUNTS.join("|")}>`);
  process.exit(1);
}
const statePath = resolve(process.cwd(), "e2e/.auth", `${account}.json`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(BASE_URL);
} catch {
  console.error(`${BASE_URL} 에 연결할 수 없어요. 먼저 "npm run dev" 를 켜세요.`);
  await browser.close();
  process.exit(1);
}

console.log(`\n열린 브라우저에서 ${account} 용 카카오 계정으로 로그인하세요.`);
console.log("로그인이 끝나 앱 화면으로 돌아오면 이 터미널에서 Enter 를 누르세요.");
const rl = createInterface({ input: process.stdin, output: process.stdout });
await rl.question("");
rl.close();

// The Supabase session cookie is what the app (and the gate) actually needs.
const cookies = await context.cookies();
if (!cookies.some((cookie) => /^sb-.+-auth-token/.test(cookie.name))) {
  console.error("로그인 세션을 찾지 못했어요. 로그인을 끝낸 뒤 다시 실행하세요. (파일은 바꾸지 않았어요)");
  await browser.close();
  process.exit(1);
}

mkdirSync(dirname(statePath), { recursive: true });
await context.storageState({ path: statePath });
chmodSync(statePath, 0o600); // holds live session tokens
await browser.close();

console.log(`\n저장했어요: ${statePath}`);
console.log("이 계정의 user id 는 다음 \"npm run test:e2e\" 시작 때 안내 문구로 나와요. E2E_ACCOUNT_IDS 에 넣어주세요.");
