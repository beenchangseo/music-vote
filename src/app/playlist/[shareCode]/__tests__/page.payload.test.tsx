import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "@/actions/__tests__/fake-supabase";

const HOST = "9c1f6a2e-1111-4111-8111-000000000001";
const ADDER = "9c1f6a2e-2222-4222-8222-000000000002";
const OTHER = "9c1f6a2e-3333-4333-8333-000000000003";

const state = vi.hoisted(() => ({
  user: null as { id: string; nickname: string; avatarUrl: string | null } | null,
  creator: null as string | null,
  setlistFails: false,
}));

const song = (id: string, addedBy: string | null) => ({
  id,
  playlist_id: "7d0c2b4a-5555-4555-8555-000000000010",
  title: id,
  artist: null,
  youtube_url: `https://youtu.be/${id}`,
  youtube_video_id: id,
  thumbnail_url: null,
  added_by: "멤버",
  added_by_user_id: addedBy,
  key_memo: null,
  key_root: null,
  key_mode: null,
  tempo_bpm: null,
  duration_seconds: null,
  difficulty: null,
  genre: null,
  created_at: `2026-10-01T10:0${id.length}:00+00:00`,
});

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () =>
    createFakeClient((op) => {
      if (op.table === "playlists") {
        return {
          data: {
            id: "7d0c2b4a-5555-4555-8555-000000000010",
            title: "합주",
            share_code: "qDPJnh1d",
            deadline: null,
            created_at: "2026-10-01T00:00:00+00:00",
            setlist_count: null,
            announcement: null,
            setlist_confirmed: false,
            creator_nickname: "방장",
            creator_user_id: state.creator,
            votes_anonymous: true,
            voting_mode: "free",
            default_vote_limit: 3,
            setlist_edit_mode: "everyone",
            team_id: null,
          },
        };
      }
      if (op.table === "songs") return { data: [song("mine", ADDER), song("hosts", HOST), song("legacy", null)] };
      if (op.table === "playlist_members") return { data: null, count: 2 };
      if (op.table === "setlist_items" && state.setlistFails) return { data: null, error: { code: "57014" } };
      return { data: [] };
    }).client,
  createServerSupabaseClient: async () =>
    createFakeClient((op) =>
      op.table === "playlist_stats" ? { data: { song_count: 3, participant_count: 2 } } : { data: [] },
    ).client,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/actions/team", () => ({ getMyTeams: async () => ({ teams: [] }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/components/playlist/PlaylistClient", () => ({ default: () => null }));

import PlaylistPage from "../page";

type ShownSong = { id: string; canDelete: boolean };
type ClientProps = { playlist: { archived: boolean }; songs: ShownSong[]; loggedIn: boolean; isHost: boolean; initialTab: string };

/** What the browser receives: the props the server page hands to the client component. */
async function pageData(query: { [key: string]: string | string[] | undefined } = {}) {
  const element = (await PlaylistPage({
    params: Promise.resolve({ shareCode: "qDPJnh1d" }),
    searchParams: Promise.resolve(query),
  })) as ReactElement<ClientProps>;
  return { props: element.props, wire: JSON.stringify(element.props) };
}

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  return [];
}

const canDelete = (songs: ShownSong[]) => Object.fromEntries(songs.map((shown) => [shown.id, shown.canDelete]));

beforeEach(() => {
  state.user = null;
  state.creator = HOST;
  state.setlistFails = false;
});

describe("/playlist/[shareCode] page data (ADR 0011: no account id in any mode)", () => {
  it.each([
    ["a logged-out visitor", null],
    ["a member who added a song", ADDER],
    ["another member", OTHER],
    ["the host", HOST],
  ])("carries no account id for %s", async (_viewer, userId) => {
    state.user = userId ? { id: userId, nickname: "멤버", avatarUrl: null } : null;

    const { wire, props } = await pageData();

    for (const id of [HOST, ADDER, OTHER]) expect(wire).not.toContain(id);
    expect(keysOf(props).filter((key) => /user_?id/i.test(key))).toEqual([]);
  });

  it("tells a logged-out visitor it is neither logged in nor the host and can delete nothing", async () => {
    const { props } = await pageData();

    expect(props).toMatchObject({ loggedIn: false, isHost: false, playlist: { archived: false } });
    expect(canDelete(props.songs)).toEqual({ mine: false, hosts: false, legacy: false });
  });

  it("lets a member delete only the song they added", async () => {
    state.user = { id: ADDER, nickname: "기타", avatarUrl: null };

    const { props } = await pageData();

    expect(props).toMatchObject({ loggedIn: true, isHost: false });
    expect(canDelete(props.songs)).toEqual({ mine: true, hosts: false, legacy: false });
  });

  it("lets the host delete every song", async () => {
    state.user = { id: HOST, nickname: "방장", avatarUrl: null };

    const { props } = await pageData();

    expect(props).toMatchObject({ loggedIn: true, isHost: true });
    expect(canDelete(props.songs)).toEqual({ mine: true, hosts: true, legacy: true });
  });

  it("marks a pre-login playlist archived, where nobody is host and nothing can be deleted", async () => {
    state.creator = null;
    state.user = { id: ADDER, nickname: "기타", avatarUrl: null };

    const { props } = await pageData();

    expect(props).toMatchObject({ loggedIn: true, isHost: false, playlist: { archived: true } });
    expect(canDelete(props.songs)).toEqual({ mine: false, hosts: false, legacy: false });
  });
});

describe("/playlist/[shareCode] first tab (#80)", () => {
  it.each([
    { link: "a plain link", query: {}, tab: "playlist" },
    { link: "a setlist link", query: { tab: "setlist" }, tab: "setlist" },
    { link: "the Kakao setlist card", query: { utm_source: "kakao", utm_medium: "share", variant: "setlist", tab: "setlist" }, tab: "setlist" },
    { link: "an edited tab", query: { tab: "<script>" }, tab: "playlist" },
  ])("opens $link on the $tab tab", async ({ query, tab }) => {
    const { props } = await pageData(query);

    expect(props.initialTab).toBe(tab);
  });

  it("opens a setlist link on 후보곡 when the setlist could not be read", async () => {
    state.setlistFails = true;

    const { props } = await pageData({ tab: "setlist" });

    expect(props.initialTab).toBe("playlist");
  });
});
