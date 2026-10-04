import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient, type FakeOp, type FakeResult } from "./fake-supabase";

const state = vi.hoisted(() => ({
  admin: null as unknown as ReturnType<typeof createFakeClient>,
  session: null as unknown as ReturnType<typeof createFakeClient>,
  assertPlaylistWritable: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => state.admin.client,
  createServerSupabaseClient: async () => state.session.client,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1", nickname: "기타", avatarUrl: null })),
}));
vi.mock("@/lib/playlist-access", () => ({ assertPlaylistWritable: state.assertPlaylistWritable }));
vi.mock("@/lib/youtube", () => ({
  extractVideoId: () => "vid-123",
  fetchVideoMetadata: vi.fn(async () => ({
    title: "Creep",
    author_name: "Radiohead",
    thumbnail_url: "https://img/creep.jpg",
  })),
}));
vi.mock("@/lib/youtube-data", () => ({
  fetchSingleVideoDetails: vi.fn(async () => ({ durationSeconds: 236, embeddable: true })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addSong } from "../song";

const ROOM = "room-new";
const TEAM = "team-1";
const URL = "https://youtu.be/vid-123";

const ok = (data: unknown = null): FakeResult => ({ data, error: null });

const meta = (overrides: Record<string, unknown> = {}) => ({
  key_memo: "+3키",
  tempo_bpm: 92,
  key_root: "G",
  key_mode: "major",
  created_at: "2026-10-01T00:00:00+00:00",
  playlists: { team_id: TEAM },
  ...overrides,
});

/** Admin responder: the room's team, then the matching songs of the band. */
function admin(room: FakeResult, songs: FakeResult = ok([])) {
  return (op: FakeOp): FakeResult => {
    if (op.table === "playlists") return room;
    if (op.table === "songs") return songs;
    return ok();
  };
}

const songInsert = () => state.session.ops.find((op) => op.table === "songs" && op.action === "insert");
const songLookup = () => state.admin.ops.find((op) => op.table === "songs");

describe("addSong E4 key/BPM carry-over", () => {
  beforeEach(() => {
    state.session = createFakeClient();
    state.assertPlaylistWritable.mockReset().mockResolvedValue(undefined);
  });

  it("copies the four values from the most recent matching song in the same band", async () => {
    state.admin = createFakeClient(admin(ok({ team_id: TEAM }), ok([meta()])));

    await expect(addSong(ROOM, URL, "share")).resolves.toMatchObject({ success: true, prefilledMeta: true });

    expect(songInsert()?.row).toMatchObject({
      playlist_id: ROOM,
      youtube_video_id: "vid-123",
      key_memo: "+3키",
      tempo_bpm: 92,
      key_root: "G",
      key_mode: "major",
    });
    const lookup = songLookup();
    // Same video, same band only, other rooms, at least one value set, newest first, one row.
    expect(lookup?.filters).toEqual({
      youtube_video_id: "vid-123",
      "playlists.team_id": TEAM,
      "neq:playlist_id": ROOM,
      or: "key_memo.not.is.null,tempo_bpm.not.is.null,key_root.not.is.null,key_mode.not.is.null",
    });
    expect(lookup?.columns).toContain("playlists!inner(team_id)");
    expect(lookup?.orders).toEqual([{ column: "created_at", ascending: false }]);
    expect(lookup?.limit).toBe(1);
  });

  it("copies the row as-is without mixing fields from different rows", async () => {
    state.admin = createFakeClient(
      admin(
        ok({ team_id: TEAM }),
        ok([
          meta({ key_memo: null, tempo_bpm: 120, key_root: null, key_mode: null }),
          meta({ key_memo: "+2키", tempo_bpm: 80, key_root: "A", key_mode: "minor" }),
        ]),
      ),
    );

    await addSong(ROOM, URL, "share");
    expect(songInsert()?.row).toMatchObject({ key_memo: null, tempo_bpm: 120, key_root: null, key_mode: null });
  });

  it("never takes a song from another band, even if the query returned one", async () => {
    state.admin = createFakeClient(admin(ok({ team_id: TEAM }), ok([meta({ playlists: { team_id: "team-other" } })])));

    await expect(addSong(ROOM, URL, "share")).resolves.toMatchObject({ prefilledMeta: false });
    expect(songInsert()?.row).not.toHaveProperty("key_memo");
    expect(songInsert()?.row).not.toHaveProperty("tempo_bpm");
  });

  it("skips rows where all four values are empty", async () => {
    state.admin = createFakeClient(
      admin(ok({ team_id: TEAM }), ok([meta({ key_memo: null, tempo_bpm: null, key_root: null, key_mode: null })])),
    );

    await expect(addSong(ROOM, URL, "share")).resolves.toMatchObject({ prefilledMeta: false });
    expect(songInsert()?.row).not.toHaveProperty("key_root");
  });

  it("does not look for songs when the room has no band", async () => {
    state.admin = createFakeClient(admin(ok({ team_id: null })));

    await expect(addSong(ROOM, URL, "share")).resolves.toMatchObject({ success: true, prefilledMeta: false });
    expect(songLookup()).toBeUndefined();
  });

  const timeout: FakeResult = { data: null, error: { code: "57014", message: "timeout" } };
  it.each([
    ["the band lookup errors", timeout, ok([meta()])],
    ["the song lookup errors", ok({ team_id: TEAM }), timeout],
  ])("still adds the song when %s, and logs it", async (_label, room, songs) => {
    state.admin = createFakeClient(admin(room, songs));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(addSong(ROOM, URL, "share")).resolves.toMatchObject({ success: true, prefilledMeta: false });
    expect(songInsert()?.row).toMatchObject({ playlist_id: ROOM, title: "Creep" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("still adds the song when the lookup throws", async () => {
    state.admin = createFakeClient(() => {
      throw new TypeError("fetch failed");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(addSong(ROOM, URL, "share")).resolves.toMatchObject({ success: true, prefilledMeta: false });
    expect(songInsert()).toBeDefined();
    log.mockRestore();
  });
});
