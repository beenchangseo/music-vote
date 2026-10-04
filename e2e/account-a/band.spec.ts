import { expect, expectNoAlert, skipWhen, test, withAccountPage } from "../fixtures";
import { readAccountUserId } from "../helpers/accounts";
import { E2E_PREFIX, adminClient, adminProblem } from "../helpers/cleanup";
import { authProblem, metricsProblem } from "../helpers/guards";

// WRITES to the production DB with BOTH test accounts: one room, one band made from it,
// account-b's membership, one room made from the band. Everything is deleted afterwards
// (also when the test fails) by the `cleanup` fixture: rooms by title, the band by name
// (team_members cascade). Plan T9 / test plan "밴드 흐름".

test.describe("account-a + account-b: band flow", () => {
  skipWhen(
    authProblem("account-a"),
    authProblem("account-b"),
    adminProblem(),
    metricsProblem("account-a"),
    metricsProblem("account-b"),
  );

  test("room → band → invite → join → band room → home list → new link → leave", async ({ page, browser, baseURL, cleanup }) => {
    test.setTimeout(240_000);
    const { error: schemaError } = await adminClient().from("teams").select("id").limit(1);
    test.skip(schemaError !== null, "teams 테이블이 없어요 (supabase-migration-v19.sql 적용 전)");

    const ownerId = readAccountUserId("account-a")!;
    const stamp = Date.now().toString(36);
    const roomTitle = `${E2E_PREFIX} 밴드 방 ${stamp}`;
    const bandName = `${E2E_PREFIX} 밴드 ${stamp}`;
    const bandRoomTitle = `${E2E_PREFIX} 밴드 새 방 ${stamp}`;
    // Register first: a failure halfway still removes what was written.
    cleanup.room(roomTitle, ownerId);
    cleanup.room(bandRoomTitle, ownerId);
    cleanup.team(bandName, ownerId);

    // 1. account-a makes a room.
    await page.goto("/new");
    await page.getByPlaceholder(/어떤 합주예요/).fill(roomTitle);
    await page.getByRole("button", { name: "합주방 만들기", exact: true }).click();
    await page.getByRole("button", { name: /곡 추가하러 가기/ }).click();
    await page.waitForURL(/\/playlist\/[\w-]+$/);

    // 2. Room settings → "이 멤버로 밴드 만들기" → band home with the one-time banner.
    await page.getByRole("button", { name: "방 설정" }).first().click();
    await page.getByRole("button", { name: "이 멤버로 밴드 만들기" }).click();
    await expect(page.getByLabel("밴드 이름")).toBeFocused();
    await page.getByLabel("밴드 이름").fill(bandName);
    await page.getByRole("button", { name: "밴드 만들기", exact: true }).click();
    // ?created=1 is stripped on first mount.
    await page.waitForURL(/\/band\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("status")).toContainText("밴드를 만들었어요");
    await expect(page.getByRole("heading", { level: 1, name: bandName })).toBeVisible();
    const teamId = new URL(page.url()).pathname.split("/").pop()!;

    // 3. The invite link from the invite sheet.
    await page.getByRole("button", { name: "멤버 초대" }).click();
    const sheet = page.getByRole("dialog", { name: "멤버 초대" });
    const inviteUrl = (await sheet.getByText(/\/join\//).textContent())!.trim();
    const invitePath = new URL(inviteUrl).pathname;
    await page.keyboard.press("Escape");

    // 4. account-b opens the invite and joins.
    await withAccountPage({ browser, baseURL }, "account-b", async (pageB) => {
      await pageB.goto(invitePath);
      await expect(pageB.getByRole("heading", { level: 1, name: bandName })).toBeVisible();
      await pageB.getByRole("button", { name: "밴드 들어가기" }).click();
      await pageB.waitForURL(new RegExp(`/band/${teamId}$`));
      await expect(pageB.getByRole("status")).toContainText("밴드에 들어왔어요");
    });

    // 5. account-a makes a new room from the band home.
    await page.goto(`/band/${teamId}`);
    await page.getByRole("link", { name: "새 합주방" }).click();
    await page.waitForURL(new RegExp(`/new\\?band=${teamId}$`));
    await expect(page.getByText(`${bandName}의 합주방`)).toBeVisible();
    await page.getByPlaceholder(/어떤 합주예요/).fill(bandRoomTitle);
    await page.getByRole("button", { name: "합주방 만들기", exact: true }).click();
    await expect(page.getByRole("heading", { name: bandRoomTitle, level: 2 })).toBeVisible();
    await expectNoAlert(page);

    // 6. account-b finds the band and its new room on the home screen.
    await withAccountPage({ browser, baseURL }, "account-b", async (pageB) => {
      await pageB.goto("/");
      await expect(pageB.locator("#my-bands").getByRole("link", { name: bandName })).toBeVisible();
      await expect(pageB.getByRole("link", { name: bandRoomTitle })).toBeVisible();
    });

    // 7. account-a makes a new invite link: the address stays, the old /join dies.
    await page.goto(`/band/${teamId}`);
    await page.getByRole("button", { name: "멤버 초대" }).click();
    await sheet.getByRole("button", { name: "링크 새로 만들기" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "새로 만들기" }).click();
    await expect(sheet.getByText(/\/join\//)).not.toHaveText(inviteUrl);
    await expect(page).toHaveURL(new RegExp(`/band/${teamId}$`));

    await withAccountPage({ browser, baseURL }, "account-b", async (pageB) => {
      await pageB.goto(invitePath);
      await expect(pageB.getByRole("heading", { name: "이 초대 링크는 더 이상 쓸 수 없어요" })).toBeVisible();
      // A member's band address survives the new link (R10).
      await pageB.goto(`/band/${teamId}`);
      await expect(pageB.getByRole("heading", { level: 1, name: bandName })).toBeVisible();

      // 8. account-b leaves from the quiet row at the bottom.
      await pageB.getByRole("button", { name: "밴드 나가기" }).click();
      await pageB.getByRole("alertdialog").getByRole("button", { name: "나가기" }).click();
      await pageB.waitForURL((url) => url.pathname === "/" && !url.search.includes("left"));
      await expect(pageB.getByRole("status")).toContainText(`${bandName}에서 나왔어요`);
      await expect(pageB.getByRole("link", { name: bandName })).toHaveCount(0);
    });
  });
});
