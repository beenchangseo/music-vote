import type { Page } from "@playwright/test";
import { expect, skipWhen, test } from "../fixtures";
import { roomProblem, roomShareCode } from "../helpers/guards";

// Logged-out visitor. After the anon-key lockdown every public screen must still get its data
// through the server, so these catch a read path that was left on the anon client.

test("sitemap.xml lists no room URL", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml).toContain("<urlset"); // a real sitemap, not an empty/error body
  expect(xml).not.toContain("/playlist/");
});

test.describe("fixed test room (logged out)", () => {
  skipWhen(roomProblem());

  // Song rows each carry a score badge: role=status, aria-label "점수 N점 ...".
  const scoreBadges = (page: Page) =>
    page.getByRole("status", { name: /^점수 -?\d+점/ });

  test("room page renders its title and songs", async ({ page }) => {
    const response = await page.goto(`/playlist/${roomShareCode()}`);
    expect(response?.status()).toBe(200);

    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText(/\S/);
    if (process.env.E2E_ROOM_TITLE) await expect(title).toHaveText(process.env.E2E_ROOM_TITLE);

    // Toolbar stat "N곡" must match the rows actually rendered.
    const stat = page.getByText(/^\d+곡$/).first();
    await expect(stat).not.toHaveText("0곡");
    const songCount = Number((await stat.innerText()).replace("곡", ""));
    await expect(scoreBadges(page)).toHaveCount(songCount);
  });

  test("metronome page renders", async ({ page }) => {
    const code = roomShareCode();
    await page.goto(`/playlist/${code}`);
    const roomTitle = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

    const response = await page.goto(`/playlist/${code}/metronome`);
    expect(response?.status()).toBe(200); // not the 404 an unreadable room would give
    await expect(page.getByRole("heading", { name: "메트로놈", level: 1 })).toBeVisible();
    await expect(page.getByText(roomTitle, { exact: true }).first()).toBeVisible();
  });

  test("setlist image is a real PNG", async ({ request }) => {
    const response = await request.get(`/api/setlist-image/${roomShareCode()}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");
    expect((await response.body()).length).toBeGreaterThan(5_000);
  });

  test("setlist PDF is a real PDF", async ({ request }) => {
    const response = await request.get(`/api/setlist-pdf/${roomShareCode()}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const body = await response.body();
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(2_000);
  });
});
