import { expect, skipWhen, test } from "../fixtures";
import { readAccountUserId } from "../helpers/accounts";
import { E2E_PREFIX, adminClient, adminProblem } from "../helpers/cleanup";
import { authProblem, metricsProblem } from "../helpers/guards";

// WRITES one empty band to the production DB with account-a, deleted afterwards (also on failure)
// by the `cleanup` fixture. Plan: docs/plans/2026-10-06-user-flow-map.md T9 (CEO2-A, DR1, DR3).
//
// account-a is the operator's real account. This spec only reads its playlists in the new-band
// sheet and never attaches any of them to a band: attaching would change a real playlist's band.

test.describe("account-a: a new band from the home page", () => {
  skipWhen(authProblem("account-a"), adminProblem(), metricsProblem("account-a"));

  test("home → 새 밴드 → empty band → start area → first playlist link", async ({ page, cleanup }) => {
    test.setTimeout(120_000);
    const { error: schemaError } = await adminClient().from("teams").select("created_via").limit(1);
    test.skip(schemaError !== null, "teams.created_via 가 없어요 (supabase-migration-v21.sql 적용 전)");

    const ownerId = readAccountUserId("account-a")!;
    const bandName = `${E2E_PREFIX} 홈 밴드 ${Date.now().toString(36)}`;
    // Register first: a failure halfway still removes what was written.
    cleanup.team(bandName, ownerId);

    // 1. The signed-in home has the band entry next to the playlist one (DR3).
    await page.goto("/");
    await expect(page.getByRole("button", { name: "새 플레이리스트" })).toBeVisible();
    await page.getByRole("button", { name: "새 밴드" }).click();
    const sheet = page.getByRole("dialog", { name: "밴드 만들기" });

    // 2. account-a may have playlists to build from; pick the empty band either way.
    const emptyBand = sheet.getByRole("button", { name: "멤버 없이 새 밴드로 시작" });
    if (await emptyBand.isVisible()) await emptyBand.click();
    await expect(sheet.getByLabel("밴드 이름")).toBeFocused();
    await expect(sheet.getByText("만들고 나면 단톡방에 초대 링크를 보내요")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "나중에" })).toHaveCount(0);
    await sheet.getByLabel("밴드 이름").fill(bandName);
    await sheet.getByRole("button", { name: "밴드 만들기", exact: true }).click();

    // 3. Band home in its start state (DR1): one line of success, one area, one way to invite.
    await page.waitForURL(/\/band\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: bandName })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("밴드를 만들었어요");
    const area = page.getByRole("region", { name: "첫 플레이리스트부터 시작해요" });
    const teamId = new URL(page.url()).pathname.split("/").pop()!;
    // account-a owns playlists outside any band, so putting one in is the main button (DR1 · DR8) and
    // making a new one stays as a link. Open the sheet to see the list, then close it WITHOUT attaching:
    // these are the operator's real playlists.
    const attach = area.getByRole("button", { name: "있던 플레이리스트 넣기" });
    if (await attach.count()) {
      await expect(area.getByRole("link", { name: "새 플레이리스트 만들기" })).toHaveAttribute("href", `/new?band=${teamId}`);
      await attach.click();
      const attachSheet = page.getByRole("dialog", { name: /^있던 플레이리스트 넣기 · \d+개$/ });
      await expect(attachSheet.getByText("넣어도 참여자는 밴드 멤버가 되지 않아요")).toBeVisible();
      await expect(attachSheet.getByRole("button", { name: /넣기$/ }).first()).toBeVisible();
      await attachSheet.getByRole("button", { name: "닫기" }).click();
      await expect(attachSheet).toHaveCount(0);
    } else {
      await expect(area.getByRole("link", { name: "첫 플레이리스트 만들기" })).toHaveAttribute("href", `/new?band=${teamId}`);
    }
    await expect(page.getByRole("button", { name: "멤버 초대" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "더 부르기" })).toHaveCount(0);

    // 4. The invite sheet opens from the start area.
    await area.getByRole("button", { name: "카톡으로 멤버 부르기" }).click();
    await expect(page.getByRole("dialog", { name: "멤버 초대" }).getByText(/\/join\//)).toBeVisible();

    // 5. The DB says it was made at home with the owner alone.
    const db = adminClient();
    const { data: team } = await db.from("teams").select("created_via").eq("id", teamId).single();
    expect(team?.created_via).toBe("home");
    const { count } = await db.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", teamId);
    expect(count).toBe(1);
  });
});
