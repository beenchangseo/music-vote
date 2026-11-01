import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp } from "@/actions/__tests__/fake-supabase";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { GET } from "../route";

const songs = [
  { id: "low", created_at: "2026-10-01T00:00:00Z", votes: [{ vote_type: 1 }] },
  { id: "early-top", created_at: "2026-10-02T00:00:00Z", votes: [{ vote_type: 1 }, { vote_type: 1 }] },
  { id: "late-top", created_at: "2026-10-03T00:00:00Z", votes: [{ vote_type: 1 }, { vote_type: 1 }] },
];

function database() {
  const { client, ops } = createFakeClient((op: FakeOp) => {
    if (op.table === "playlists" && op.action === "select") {
      return { data: [{ id: "p", share_code: "abc123", setlist_count: 2, deadline: "2026-10-31T00:00:00Z" }] };
    }
    if (op.table === "songs") return { data: songs };
    return { data: null, error: null };
  });
  mocks.from.mockImplementation(client.from);
  return ops;
}

async function run() {
  const res = await GET(new NextRequest("https://plypick.kr/api/cron/auto-confirm-setlist"));
  return (await res.json()) as { results: Record<string, unknown>[] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "");
});

describe("GET /api/cron/auto-confirm-setlist", () => {
  it("confirms through the locked function alone, offering the top songs by score with the earlier song first on a tie", async () => {
    const ops = database();
    mocks.rpc.mockResolvedValue({ data: { items: [] }, error: null });

    const { results } = await run();

    expect(mocks.rpc).toHaveBeenCalledWith("confirm_setlist", { p_playlist_id: "p", p_song_ids: ["early-top", "late-top"] });
    expect(ops.filter((op) => op.action !== "select")).toEqual([]);
    expect(results).toEqual([{ shareCode: "abc123", playlistId: "p", result: "confirmed", picked: 2 }]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/playlist/abc123");
  });

  it("reports a failed confirm and leaves the playlist for the next run", async () => {
    const ops = database();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "song_not_found" } });

    const { results } = await run();

    expect(ops.filter((op) => op.action !== "select")).toEqual([]);
    expect(results).toEqual([{ shareCode: "abc123", playlistId: "p", result: "failed", reason: "song_not_found" }]);
  });
});
