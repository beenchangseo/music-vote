import { expect, skipWhen, test } from "../fixtures";
import { authProblem } from "../helpers/guards";

// Read-only. Proves the saved second-account login still works (and gets written back).
// Band-flow specs that need two accounts (T9: invite, join, new room from the band) go here.

test.describe("account-b: saved login", () => {
  skipWhen(authProblem("account-b"));

  test("/new shows the create form, not the login prompt", async ({ page }) => {
    await page.goto("/new");
    await expect(page.getByPlaceholder(/어떤 합주예요/)).toBeVisible();
    await expect(page.getByText("합주방을 만들려면 로그인이 필요해요")).toHaveCount(0);
  });
});
