import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "./fake-supabase";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  denial: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/setlist-permissions", () => ({ setlistEditorDenial: mocks.denial, assertSetlistEditor: vi.fn() }));
vi.mock("@/lib/playlist-admin", () => ({ assertPlaylistAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { getSetlistItems, insertSetlistBlock, removeSetlistItem, updateSetlistOrder } from "../setlist";

const items = [{ id: "item-1", position: 0 }, { id: "new", position: 1 }];
const interval = { kind: "interval", label: "  멘트 ", description: "", durationSeconds: 60 } as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.denial.mockResolvedValue(null);
});

describe("insertSetlistBlock", () => {
  it("puts an interval before the block under the (+) and returns the whole setlist", async () => {
    mocks.rpc.mockResolvedValue({ data: { item_id: "new", items }, error: null });

    const result = await insertSetlistBlock("p", { before: "item-2" }, interval, "abc123");

    expect(mocks.rpc).toHaveBeenCalledWith("insert_setlist_item", {
      p_playlist_id: "p",
      p_before_item_id: "item-2",
      p_item_type: "interval",
      p_song_id: null,
      p_label: "멘트",
      p_description: null,
      p_duration_seconds: 60,
    });
    expect(result).toEqual({ success: true, itemId: "new", items });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/playlist/abc123");
  });

  it("appends a candidate song at the end with no label or length of its own", async () => {
    mocks.rpc.mockResolvedValue({ data: { item_id: "new", items }, error: null });

    await insertSetlistBlock("p", { before: null }, { kind: "song", songId: "song-1" }, "abc123");

    expect(mocks.rpc).toHaveBeenCalledWith("insert_setlist_item", {
      p_playlist_id: "p",
      p_before_item_id: null,
      p_item_type: "song",
      p_song_id: "song-1",
      p_label: null,
      p_description: null,
      p_duration_seconds: 0,
    });
  });

  it("refuses a block it cannot store before checking access or writing", async () => {
    const result = await insertSetlistBlock("p", { before: null }, { ...interval, label: "가".repeat(51) }, "abc123");

    expect(result).toEqual({ success: false, reason: "invalid_block" });
    expect(mocks.denial).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["archived", "not_logged_in", "not_editor"] as const)("returns %s without writing", async (reason) => {
    mocks.denial.mockResolvedValue(reason);

    await expect(insertSetlistBlock("p", { before: null }, interval, "abc123")).resolves.toEqual({ success: false, reason });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["slot_gone", "slot_gone"],
    ["song_not_found", "song_not_found"],
    ["deadlock detected", "write_failed"],
  ])("maps the database answer %s to %s", async (message, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message } });

    await expect(insertSetlistBlock("p", { before: "item-2" }, interval, "abc123")).resolves.toEqual({ success: false, reason });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("fails when the database answers without a setlist", async () => {
    mocks.rpc.mockResolvedValue({ data: { item_id: "new" }, error: null });

    await expect(insertSetlistBlock("p", { before: null }, interval, "abc123")).resolves.toEqual({ success: false, reason: "write_failed" });
  });
});

describe("updateSetlistOrder", () => {
  it("saves the whole order in one call and returns the setlist the server now has", async () => {
    mocks.rpc.mockResolvedValue({ data: { items }, error: null });

    const result = await updateSetlistOrder("p", null, ["new", "item-1"], "abc123");

    expect(mocks.rpc).toHaveBeenCalledWith("reorder_setlist_items", { p_playlist_id: "p", p_item_ids: ["new", "item-1"] });
    expect(result).toEqual({ success: true, items });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/playlist/abc123");
  });

  it("returns the reason when the editor may not reorder", async () => {
    mocks.denial.mockResolvedValue("not_editor");

    await expect(updateSetlistOrder("p", null, ["item-1"], "abc123")).resolves.toEqual({ success: false, reason: "not_editor" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses an order that names a block twice", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "invalid_order" } });

    await expect(updateSetlistOrder("p", null, ["item-1", "item-1"], "abc123")).resolves.toEqual({ success: false, reason: "invalid_order" });
  });
});

describe("removeSetlistItem", () => {
  function fake(deleteError: { message: string } | null = null) {
    const { client, ops } = createFakeClient((op) => (op.action === "delete" ? { error: deleteError } : { data: items }));
    mocks.from.mockImplementation(client.from);
    return ops;
  }

  it("removes the block from this playlist and returns the setlist the server now has", async () => {
    const ops = fake();

    const result = await removeSetlistItem("p", null, "item-9", "abc123");

    expect(ops[0]).toMatchObject({ table: "setlist_items", action: "delete", filters: { id: "item-9", playlist_id: "p" } });
    expect(result).toEqual({ success: true, items });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/playlist/abc123");
  });

  it("returns the reason without deleting when the editor may not edit", async () => {
    const ops = fake();
    mocks.denial.mockResolvedValue("archived");

    await expect(removeSetlistItem("p", null, "item-9", "abc123")).resolves.toEqual({ success: false, reason: "archived" });
    expect(ops).toHaveLength(0);
  });

  it("fails when the delete fails", async () => {
    fake({ message: "boom" });

    await expect(removeSetlistItem("p", null, "item-9", "abc123")).resolves.toEqual({ success: false, reason: "write_failed" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("getSetlistItems", () => {
  it("breaks position ties the way the position functions do", async () => {
    const { client, ops } = createFakeClient(() => ({ data: [] }));
    mocks.from.mockImplementation(client.from);

    await getSetlistItems("p");

    expect(ops[0].orders).toEqual([
      { column: "position", ascending: true },
      { column: "created_at", ascending: true },
      { column: "id", ascending: true },
    ]);
  });
});
