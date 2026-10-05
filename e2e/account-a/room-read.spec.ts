import type { Page } from "@playwright/test";
import { expect, expectNoAlert, skipWhen, test } from "../fixtures";
import { authProblem, roomProblem, roomShareCode } from "../helpers/guards";

// Logged in as the first test account, read-only against the fixed test room.
// (Opening a room registers the account as a member once; the row is idempotent and
// the account is excluded from metrics.)
//
// The fixed room needs: >= 1 song, >= 1 setlist song, and the account has voted on a song
// (only for the optional E2E_ACCOUNT_A_HAS_VOTE check).

test.describe("account-a: fixed test room screens", () => {
  skipWhen(authProblem("account-a"), roomProblem());

  const scoreBadges = (page: Page) => page.getByRole("status", { name: /^점수 -?\d+점/ });

  // The bottom tab bar is the last element named "셋리스트" / "합주" in the DOM: song rows
  // carry their own "셋리스트" button, and the tab bar renders after them.
  // aria-current flips in the same render that starts the lazy data load, so waiting for it
  // makes the "loading finished" checks below meaningful instead of racing the click.
  async function openTab(page: Page, name: "셋리스트" | "합주") {
    const tab = page.getByRole("button", { name, exact: true }).last();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-current", "page");
  }

  const LOAD_TIMEOUT = 30_000; // server action behind a cold `next dev` route

  test.beforeEach(async ({ page }) => {
    await page.goto(`/playlist/${roomShareCode()}`);
    // Logged in and the room is live (archived rooms show no nickname).
    await expect(page.getByText(/으로 참여 중/)).toBeVisible();
  });

  test("candidate songs render with scores and my-vote controls", async ({ page }) => {
    const stat = page.getByText(/^\d+곡$/).first();
    await expect(stat).not.toHaveText("0곡");
    const songCount = Number((await stat.innerText()).replace("곡", ""));
    await expect(scoreBadges(page)).toHaveCount(songCount);

    // Logged in => vote buttons are live, not the "로그인하고 찬성하기" gate.
    await expect(page.getByRole("button", { name: /^로그인하고 (찬성|반대)하기$/ })).toHaveCount(0);
    const voteButtons = page.getByRole("button", { name: /^(찬성표 추가|반대표 추가|찬성표 한 개 취소|반대표 한 개 취소)$/ });
    await expect(voteButtons).toHaveCount(songCount * 2);

    // "My vote" is only drawn with a CSS class (no aria state), so this reads the class.
    // Opt-in: needs the owner to have voted once with account-a on the fixed room.
    if (process.env.E2E_ACCOUNT_A_HAS_VOTE === "1") {
      await expect(page.locator('button[class~="bg-upvote/15"], button[class~="bg-downvote/15"]').first()).toBeVisible();
    }

    await expectNoAlert(page); // e.g. "참여자 등록에 실패했습니다"
  });

  test("setlist tab shows the setlist", async ({ page }) => {
    await openTab(page, "셋리스트");
    await expect(page.getByText("셋리스트 불러오는 중...")).toBeHidden({ timeout: LOAD_TIMEOUT });
    await expect(page.getByText("셋리스트가 비어있어요")).toHaveCount(0);
    await expect(page.getByText(/^\d+곡$/).first()).not.toHaveText("0곡");
  });

  test("rehearsal tab shows the current song and its comment area", async ({ page }) => {
    await openTab(page, "합주");
    await expect(page.getByText("합주 정보 불러오는 중...")).toBeHidden({ timeout: LOAD_TIMEOUT });
    await expect(page.getByText("셋리스트에 곡을 넣으면 순서대로 진행할 수 있어요")).toHaveCount(0);

    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible(); // progress "1 / N"
    await expect(page.getByRole("button", { name: /^BPM (\d+ 고치기|적어두기)$/ })).toBeVisible();
    await expect(page.getByText("이 곡 코멘트")).toBeVisible();
    await expect(page.getByRole("button", { name: "이전 곡" })).toBeVisible();
  });
});
