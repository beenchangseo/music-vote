import { ACCOUNTS, readAccountUserId } from "./helpers/accounts";
import { adminProblem, sweepLeftovers } from "./helpers/cleanup";
import { prerequisiteProblems } from "./helpers/guards";

export default async function globalSetup(): Promise<void> {
  const problems = prerequisiteProblems();
  if (problems.length > 0) {
    console.warn(`[e2e] 아래 조건이 빠져서 해당 스펙은 건너뛰어요:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }

  // A previous run that was killed (Ctrl-C, crash) never reached its cleanup.
  // Heal that first: only [e2e]-marked rows of the saved test accounts are touched.
  const testUserIds = ACCOUNTS.map(readAccountUserId).filter((id): id is string => id !== null);
  if (testUserIds.length === 0 || adminProblem()) return;
  try {
    await sweepLeftovers(testUserIds);
  } catch (error) {
    console.warn(`[e2e] 이전 실행의 [e2e] 잔여 데이터를 지우지 못했어요:\n${error instanceof Error ? error.message : String(error)}`);
  }
}
