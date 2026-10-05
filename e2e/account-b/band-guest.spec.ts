import { randomUUID } from "node:crypto";
import { expect, skipWhen, test } from "../fixtures";
import { readAccountUserId } from "../helpers/accounts";
import { E2E_PREFIX, adminClient, adminProblem } from "../helpers/cleanup";
import { authProblem, metricsProblem } from "../helpers/guards";

// WRITES to the production DB through the service role only: one band owned by account-a
// (no rooms). account-b never joins; it checks what a non-member sees. The band is deleted
// afterwards (also when the test fails) by the `cleanup` fixture.

test.describe("account-b: band pages as a non-member", () => {
  skipWhen(
    authProblem("account-a"),
    authProblem("account-b"),
    adminProblem(),
    metricsProblem("account-a"),
    metricsProblem("account-b"),
  );

  test("members-only band home, refused /new?band=, invite screen, dead invite", async ({ page, browser, baseURL, cleanup }) => {
    const db = adminClient();
    const { error: schemaError } = await db.from("teams").select("id").limit(1);
    test.skip(schemaError !== null, "teams 테이블이 없어요 (supabase-migration-v19.sql 적용 전)");

    const ownerId = readAccountUserId("account-a")!;
    const name = `${E2E_PREFIX} 손님 밴드 ${Date.now().toString(36)}`;
    const inviteCode = randomUUID().replace(/-/g, "").slice(0, 10);
    cleanup.team(name, ownerId);

    const { data: team, error } = await db
      .from("teams")
      .insert({ name, invite_code: inviteCode, created_by: ownerId })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    const { error: memberError } = await db
      .from("team_members")
      .insert({ team_id: team!.id, user_id: ownerId, display_name: "e2e owner", role: "owner" });
    expect(memberError, memberError?.message).toBeNull();

    // Band home: name + reason + the invite-link hint, nothing else.
    await page.goto(`/band/${team!.id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("밴드 멤버만 볼 수 있어요")).toBeVisible();
    await expect(page.getByText("들어가려면 밴드 멤버에게 초대 링크를 받아 주세요")).toBeVisible();
    await expect(page.getByText("e2e owner")).toHaveCount(0);

    // A band room cannot be made by a non-member, and no invite is offered.
    await page.goto(`/new?band=${team!.id}`);
    await expect(page.getByText("밴드 멤버만 만들 수 있어요")).toBeVisible();
    await expect(page.getByPlaceholder(/어떤 합주예요/)).toHaveCount(0);

    await page.goto(`/new?band=${randomUUID()}`);
    await expect(page.getByText("밴드를 찾을 수 없어요")).toBeVisible();

    // The invite screen shows the band without joining by itself.
    await page.goto(`/join/${inviteCode}?join=1`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("멤버 1명")).toBeVisible();
    await expect(page.getByRole("button", { name: "밴드 들어가기" })).toBeVisible();
    // No mark cookie: ?join=1 is stripped and nothing happens.
    await page.waitForURL(new RegExp(`/join/${inviteCode}$`));
    const { count } = await db
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", team!.id);
    expect(count).toBe(1);

    // A dead invite code: the 7A copy plus the way back for logged-in people (4A).
    await page.goto("/join/ZZZZZZZZZZ");
    await expect(page.getByRole("heading", { name: "이 초대 링크는 더 이상 쓸 수 없어요" })).toBeVisible();
    await expect(page.getByRole("link", { name: "내 밴드 보기" })).toBeVisible();

    // Logged out: log in first, then the same band address.
    // browser.newContext() inherits the project's storageState, so the logout must be explicit.
    const anon = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const anonPage = await anon.newPage();
      await anonPage.goto(`/band/${team!.id}`);
      await expect(anonPage.getByText("멤버라면 로그인하면 바로 들어가요")).toBeVisible();
      await expect(anonPage.getByRole("button", { name: "카카오로 로그인" })).toBeVisible();
    } finally {
      await anon.close();
    }
  });
});
