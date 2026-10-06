import { expect, expectNoAlert, keepRoomOutOfBand, skipWhen, test } from "../fixtures";
import { E2E_PREFIX, adminProblem } from "../helpers/cleanup";
import { authProblem, metricsProblem } from "../helpers/guards";
import { readAccountUserId } from "../helpers/accounts";

// WRITES to the production DB: creates one room through the real /new form.
// The room is deleted afterwards (also when the test fails) by the `cleanup` fixture.

test.describe("account-a: create a room", () => {
  skipWhen(authProblem("account-a"), adminProblem(), metricsProblem("account-a"));

  test("/new creates a room and lands on its page", async ({ page, cleanup }) => {
    const userId = readAccountUserId("account-a")!;
    const title = `${E2E_PREFIX} 방 만들기 ${Date.now().toString(36)}`;
    // Register first: if the UI step fails after the insert, the row is still removed.
    cleanup.room(title, userId);

    await page.goto("/new");
    await page.getByPlaceholder(/어떤 합주예요/).fill(title);
    await keepRoomOutOfBand(page);
    await page.getByRole("button", { name: "플레이리스트 만들기", exact: true }).click();

    // Success screen of CreatePlaylistForm.
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
    await expectNoAlert(page); // "플레이리스트 생성에 실패했습니다" would be an alert instead
    await page.getByRole("button", { name: /곡 추가하러 가기/ }).click();

    // Room page: right title, logged-in view, empty room.
    await page.waitForURL(/\/playlist\/[\w-]+$/);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText(/으로 참여 중/)).toBeVisible();
    await expect(page.getByText("첫 곡을 추가해보세요")).toBeVisible();
  });
});
