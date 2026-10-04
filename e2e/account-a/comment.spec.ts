import type { Page } from "@playwright/test";
import { expect, expectNoAlert, skipWhen, test } from "../fixtures";
import { readAccountUserId } from "../helpers/accounts";
import { E2E_PREFIX, adminClient, adminProblem } from "../helpers/cleanup";
import { authProblem, metricsProblem, roomProblem, roomShareCode } from "../helpers/guards";

// WRITES to the production DB: adds, edits and deletes one comment on a song of the fixed room.
// The comment is removed afterwards (also when the test fails) by the `cleanup` fixture.

test.describe("account-a: comment add / edit / delete", () => {
  skipWhen(authProblem("account-a"), roomProblem(), adminProblem(), metricsProblem("account-a"));

  // Comment text of account-a that starts with the marker, as stored in the DB.
  async function storedComments(userId: string): Promise<string[]> {
    const { data, error } = await adminClient()
      .from("comments")
      .select("content")
      .eq("user_id", userId)
      .like("content", `${E2E_PREFIX}%`);
    if (error) throw new Error(`comments query failed: ${error.message}`);
    return (data ?? []).map((row) => row.content as string);
  }

  // First song card -> ⋮ menu -> "댓글" opens the comment sheet (CommentModal).
  async function openCommentSheet(page: Page) {
    await page.getByRole("button", { name: "더보기" }).first().click();
    // exact: the "댓글 N개" badge button must not match.
    await page.getByRole("button", { name: "댓글", exact: true }).click();
    await expect(page.getByPlaceholder(/메모를 남겨보세요/)).toBeVisible(); // account-a has no comment yet
  }

  test("a comment can be written, edited and deleted", async ({ page, cleanup }) => {
    const userId = readAccountUserId("account-a")!;
    const db = adminClient();

    // addOrUpdateComment overwrites an existing comment. Never touch real data: bail out
    // if account-a already has any comment in the fixed room.
    const { data: room } = await db.from("playlists").select("id").eq("share_code", roomShareCode()).single();
    expect(room, "fixed room not found by E2E_ROOM_SHARE_CODE").toBeTruthy();
    const { data: songs } = await db.from("songs").select("id").eq("playlist_id", room!.id);
    test.skip(!songs || songs.length === 0, "고정 방에 곡이 없어요");
    const { count } = await db
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("song_id", songs!.map((song) => song.id));
    test.skip((count ?? 0) > 0, "account-a 가 고정 방에 이미 댓글이 있어요. 덮어쓰기를 막으려고 건너뛰어요 (그 댓글을 지우고 다시 실행하세요)");

    // Register first: if a step fails after the insert, the row is still removed.
    cleanup.comments(userId);
    const stamp = Date.now().toString(36);
    const written = `${E2E_PREFIX} 댓글 ${stamp}`;
    const edited = `${written} (수정)`;

    await page.goto(`/playlist/${roomShareCode()}`);

    // Add
    await openCommentSheet(page);
    await page.getByPlaceholder(/메모를 남겨보세요/).fill(written);
    await page.getByRole("button", { name: "작성", exact: true }).click();
    await expect(page.getByText(written, { exact: true })).toBeVisible();
    await expectNoAlert(page);
    expect(await storedComments(userId)).toEqual([written]);

    // Edit: text changes, no error, still one row (no duplicate / 23505)
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await expect(page.getByPlaceholder(/메모를 남겨보세요/)).toHaveValue(written);
    await page.getByPlaceholder(/메모를 남겨보세요/).fill(edited);
    await page.getByRole("button", { name: "수정", exact: true }).click(); // the form's submit button
    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await expect(page.getByText(written, { exact: true })).toHaveCount(0);
    await expectNoAlert(page);
    expect(await storedComments(userId)).toEqual([edited]);

    // Delete: the card's "삭제" first, then the confirm dialog's "삭제" (rendered last in the DOM)
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByRole("heading", { name: "삭제 확인", level: 3 })).toBeVisible();
    await page.getByRole("button", { name: "삭제", exact: true }).last().click();
    await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
    await expectNoAlert(page);

    // Gone after reload, and gone in the DB (a blocked DELETE would affect 0 rows without an error)
    await page.reload();
    await openCommentSheet(page);
    await page.waitForLoadState("networkidle"); // the sheet loads its comments with a server action
    await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "작성", exact: true })).toBeVisible();
    expect(await storedComments(userId)).toEqual([]);
  });
});
