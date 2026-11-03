import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "./fake-supabase";

const HOST = "9c1f6a2e-1111-4111-8111-000000000001";
const GUITAR = "9c1f6a2e-2222-4222-8222-000000000002";
const DRUM = "9c1f6a2e-3333-4333-8333-000000000003";

const state = vi.hoisted(() => ({
  members: {} as Record<string, string[]>,
  rpc: vi.fn(),
}));

const NAMES: Record<string, string> = { [HOST]: "보컬", [GUITAR]: "기타", [DRUM]: "드럼" };

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    ...createFakeClient((op) => {
      if (op.table === "playlists") {
        return { data: { voting_mode: "allocated", votes_anonymous: true, default_vote_limit: 3, creator_user_id: HOST } };
      }
      if (op.table === "playlist_members") {
        const ids = state.members[op.filters.playlist_id as string] ?? [];
        return {
          data: ids.map((id, index) => ({
            playlist_id: op.filters.playlist_id,
            user_id: id,
            display_name: NAMES[id],
            vote_limit: id === HOST ? 5 : 3,
            joined_at: `t${index}`,
          })),
        };
      }
      if (op.table === "votes") return { data: [{ user_id: HOST }, { user_id: HOST }, { user_id: GUITAR }] };
      return { data: null };
    }).client,
    rpc: state.rpc,
  }),
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/playlist-admin", () => ({ assertPlaylistAdmin: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: HOST, nickname: "보컬", avatarUrl: null })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getVotingSettings, saveVotingSettings } from "../member";

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  state.members = { p1: [HOST, GUITAR], p2: [GUITAR, DRUM] };
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  return [];
}

async function keyOf(playlistId: string, name: string) {
  const settings = await getVotingSettings(playlistId);
  return settings.members.find((member) => member.display_name === name)!.memberKey;
}

describe("getVotingSettings", () => {
  it("marks the host's own row, so the screen finds its vote count without the host's account id", async () => {
    const settings = await getVotingSettings("p1");

    expect(settings.members.map(({ display_name, used_votes, vote_limit, isMe }) => ({ display_name, used_votes, vote_limit, isMe }))).toEqual([
      { display_name: "보컬", used_votes: 2, vote_limit: 5, isMe: true },
      { display_name: "기타", used_votes: 1, vote_limit: 3, isMe: false },
    ]);
  });

  it("sends the host no member's account id (ADR 0011)", async () => {
    const settings = await getVotingSettings("p1");

    const wire = JSON.stringify(settings);
    for (const id of [HOST, GUITAR]) expect(wire).not.toContain(id);
    expect(keysOf(settings).filter((key) => /user_?id/i.test(key))).toEqual([]);
  });

  it("gives the same participant a different key in another playlist, so keys cannot join them up", async () => {
    expect(await keyOf("p1", "기타")).not.toBe(await keyOf("p2", "기타"));
  });
});

describe("saveVotingSettings", () => {
  it("saves each limit for the participant whose key the sheet showed", async () => {
    const settings = await getVotingSettings("p1");
    const limits = settings.members.map((member) => ({ memberKey: member.memberKey, voteLimit: member.isMe ? 5 : 2 }));

    await saveVotingSettings("p1", true, "allocated", 3, limits, "share");

    expect(state.rpc).toHaveBeenCalledWith("save_playlist_voting_settings", {
      p_playlist_id: "p1",
      p_votes_anonymous: true,
      p_mode: "allocated",
      p_default_limit: 3,
      p_member_limits: [
        { user_id: HOST, vote_limit: 5 },
        { user_id: GUITAR, vote_limit: 2 },
      ],
    });
  });

  it.each([
    ["a forged key", async () => ({ memberKey: "forged-key" })],
    ["the key the same participant has in another playlist", async () => ({ memberKey: await keyOf("p2", "기타") })],
    ["an account id from a tab opened before keys", async () => ({ userId: GUITAR })],
    [
      "the key of a participant who has since left",
      async () => {
        const memberKey = await keyOf("p1", "기타");
        state.members.p1 = [HOST];
        return { memberKey };
      },
    ],
  ])("refuses %s without calling the save function", async (_case, naming) => {
    const limit = { ...(await naming()), voteLimit: 2 } as never;

    await expect(saveVotingSettings("p1", true, "allocated", 3, [limit], "share")).rejects.toThrow(
      "참여자를 찾을 수 없습니다.",
    );
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
