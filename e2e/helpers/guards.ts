import { ACCOUNTS, authStatePath, hasAuthState, readAccountUserId, type AccountName } from "./accounts";
import { adminProblem } from "./cleanup";

// Each guard returns a human-readable reason when a prerequisite is missing, else null.
// Specs turn the reason into a skip; global-setup prints all of them once per run.

export function authProblem(account: AccountName): string | null {
  if (!hasAuthState(account)) {
    return `${authStatePath(account)} 가 없어요. "npm run e2e:auth -- ${account}" 로 로그인 상태를 저장하세요`;
  }
  if (!readAccountUserId(account)) {
    return `${account} 의 저장된 로그인 상태에 세션이 없어요. "npm run e2e:auth -- ${account}" 로 다시 저장하세요`;
  }
  return null;
}

export function roomProblem(): string | null {
  return process.env.E2E_ROOM_SHARE_CODE?.trim()
    ? null
    : "E2E_ROOM_SHARE_CODE 가 없어요 (읽기 전용 고정 테스트 방의 share_code)";
}

/** Fixed room share code. Call only after roomProblem() returned null. */
export function roomShareCode(): string {
  return process.env.E2E_ROOM_SHARE_CODE!.trim();
}

/**
 * Specs that write to the production DB only run when the account is listed in
 * E2E_ACCOUNT_IDS, i.e. when it is actually excluded from the product metrics.
 */
export function metricsProblem(account: AccountName): string | null {
  const userId = readAccountUserId(account);
  if (!userId) return null; // authProblem() already reports this
  const listed = (process.env.E2E_ACCOUNT_IDS ?? "").split(",").map((id) => id.trim());
  return listed.includes(userId)
    ? null
    : `E2E_ACCOUNT_IDS 에 ${account} 의 user id(${userId})가 없어요. 넣어야 지표에서 빠져요`;
}

/** Every missing prerequisite, for the one-shot summary at the start of a run. */
export function prerequisiteProblems(): string[] {
  const problems = [
    ...ACCOUNTS.map(authProblem),
    roomProblem(),
    adminProblem(),
    ...ACCOUNTS.map(metricsProblem),
  ];
  return problems.filter((problem): problem is string => problem !== null);
}
