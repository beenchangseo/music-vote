import { describe, expect, it, vi } from "vitest";
import { createFakeClient } from "./fake-supabase";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () =>
    createFakeClient((op) => {
      if (op.table === "playlists") return { data: { voting_mode: "allocated", votes_anonymous: true, default_vote_limit: 3 } };
      if (op.table === "playlist_members") {
        return {
          data: [
            { playlist_id: "p1", user_id: "host-1", display_name: "보컬", vote_limit: 5, joined_at: "t1" },
            { playlist_id: "p1", user_id: "user-2", display_name: "기타", vote_limit: 3, joined_at: "t2" },
          ],
        };
      }
      if (op.table === "votes") return { data: [{ user_id: "host-1" }, { user_id: "host-1" }, { user_id: "user-2" }] };
      return { data: null };
    }).client,
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/playlist-admin", () => ({ assertPlaylistAdmin: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "host-1", nickname: "보컬", avatarUrl: null })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getVotingSettings } from "../member";

describe("getVotingSettings", () => {
  it("marks the host's own row, so the screen finds its vote count without the host's account id", async () => {
    const settings = await getVotingSettings("p1");

    expect(settings.members.map(({ display_name, used_votes, vote_limit, isMe }) => ({ display_name, used_votes, vote_limit, isMe }))).toEqual([
      { display_name: "보컬", used_votes: 2, vote_limit: 5, isMe: true },
      { display_name: "기타", used_votes: 1, vote_limit: 3, isMe: false },
    ]);
  });
});
