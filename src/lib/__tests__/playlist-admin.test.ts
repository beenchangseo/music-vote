import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "@/actions/__tests__/fake-supabase";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  user: null as { id: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => mocks.client }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => mocks.user) }));

import { assertPlaylistAdmin } from "../playlist-admin";

const HOST = "host";
const LINK_TOKEN = "link-token";

function room(creator: string | null) {
  const { client } = createFakeClient((op: FakeOp): FakeResult => {
    if (op.table === "playlists") return { data: { creator_user_id: creator } };
    if (op.table === "playlist_admin") return { data: { admin_token: LINK_TOKEN } };
    return { data: null };
  });
  mocks.client = client;
}

describe("assertPlaylistAdmin", () => {
  beforeEach(() => {
    mocks.user = { id: HOST };
  });

  it("lets the host through without any link token", async () => {
    room(HOST);
    await expect(assertPlaylistAdmin("p")).resolves.toBeUndefined();
  });

  it("refuses a member who is not the host, even with the right link token", async () => {
    room(HOST);
    mocks.user = { id: "member" };
    await expect(assertPlaylistAdmin("p", { adminToken: LINK_TOKEN })).rejects.toThrow();
  });

  it("refuses every host write in an archived playlist", async () => {
    room(null);
    await expect(assertPlaylistAdmin("p")).rejects.toThrow();
  });

  it("lets the device holding the link token delete an archived playlist", async () => {
    room(null);
    await expect(assertPlaylistAdmin("p", { adminToken: LINK_TOKEN })).resolves.toBeUndefined();
  });

  it.each([
    ["another token", "guess"],
    ["no token", null],
  ] as const)("refuses to delete an archived playlist with %s", async (_case, adminToken) => {
    room(null);
    await expect(assertPlaylistAdmin("p", { adminToken })).rejects.toThrow();
  });
});
