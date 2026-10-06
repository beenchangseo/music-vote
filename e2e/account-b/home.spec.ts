import { expect, skipWhen, test } from "../fixtures";
import { readAccountUserId } from "../helpers/accounts";
import { adminClient, adminProblem } from "../helpers/cleanup";
import { authProblem, metricsProblem } from "../helpers/guards";

// Read-only. account-b stays E2E-only with no band and no playlist (e2e/README.md), so its home is
// the first-login home (state A, DR2). Plan: docs/plans/2026-10-06-user-flow-map.md T9 (eng O6).

test.describe("account-b: first-login home", () => {
  skipWhen(authProblem("account-b"), adminProblem(), metricsProblem("account-b"));

  test("asks how to start, with two choices", async ({ page }) => {
    // The precondition, checked against the DB so a leftover shows up as the reason, not a wrong screen.
    const userId = readAccountUserId("account-b")!;
    const db = adminClient();
    const [created, joined, bands] = await Promise.all([
      db.from("playlists").select("title").eq("creator_user_id", userId),
      db.from("playlist_members").select("playlist_id").eq("user_id", userId),
      db.from("team_members").select("team_id").eq("user_id", userId),
    ]);
    const leftover = [
      created.data?.length ? `만든 플레이리스트 ${created.data.length}개 (${created.data.map((row) => row.title).join(", ")})` : null,
      joined.data?.length ? `참여한 플레이리스트 ${joined.data.length}개` : null,
      bands.data?.length ? `밴드 ${bands.data.length}개` : null,
    ].filter(Boolean);
    expect(leftover, `account-b 에 남은 것이 있어요. 비워야 상태 A 를 볼 수 있어요: ${leftover.join(" · ")}`).toEqual([]);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("어떻게 시작할까요?");
    await expect(page.getByRole("button", { name: "밴드로 시작하기" })).toBeVisible();
    await expect(page.getByText("멤버를 한 번 모아 두면 공연마다 바로 투표해요")).toBeVisible();
    await expect(page.getByRole("button", { name: "이번 합주곡만 정하기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "새 밴드" })).toHaveCount(0);
  });
});
