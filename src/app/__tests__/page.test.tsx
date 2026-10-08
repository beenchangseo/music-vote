// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Suspense, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPlaylistDbEntry } from "@/actions/playlist";

const state = vi.hoisted(() => ({
  cookieNames: [] as string[],
  dismissedCookie: undefined as string | undefined,
  getCurrentUser: vi.fn(),
  getMyPlaylists: vi.fn(),
  getMyTeams: vi.fn(),
  getHomeStats: vi.fn(),
  heroProps: [] as Record<string, unknown>[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => state.cookieNames.map((name) => ({ name, value: "x" })),
    get: (name: string) =>
      name === "plypick_band_prompt_dismissed" && state.dismissedCookie !== undefined
        ? { name, value: state.dismissedCookie }
        : undefined,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getCurrentUser: state.getCurrentUser,
}));
vi.mock("@/actions/playlist", () => ({ getMyPlaylists: state.getMyPlaylists, getHomeStats: state.getHomeStats }));
vi.mock("@/actions/team", () => ({ getMyTeams: state.getMyTeams }));
vi.mock("@/components/HeroCTA", () => ({
  default: (props: Record<string, unknown>) => {
    state.heroProps.push(props);
    return <div data-testid="hero" data-variant={String(props.variant)} />;
  },
}));
vi.mock("@/components/MyBands", () => ({ default: () => <div data-testid="my-bands" /> }));
vi.mock("@/components/MyPlaylists", () => ({ default: () => <div data-testid="my-playlists" /> }));
vi.mock("@/components/LeftBandNotice", () => ({ default: () => null }));
vi.mock("@/components/BandPromptCard", () => ({
  HomeBandCard: ({ candidate }: { candidate: { id: string } }) => <div data-testid="home-card" data-target={candidate.id} />,
}));
vi.mock("@/components/home/DemoVote", () => ({ default: () => null }));
vi.mock("@/components/home/DemoPlayback", () => ({ default: () => null }));
vi.mock("@/components/home/DemoSetlist", () => ({ default: () => null }));
vi.mock("@/components/home/DemoBand", () => ({ default: () => null }));

import Home from "../page";
import HomeSkeleton from "@/components/HomeSkeleton";

const ME = { id: "u-me", nickname: "보컬", avatarUrl: null };
const SESSION_COOKIE = "sb-abcdef-auth-token";
const TEAM = { id: "t-1", name: "일코해제", nextShowAt: null, role: "owner" as const, roomCount: 1 };

function playlist(id: string, extra: Partial<MyPlaylistDbEntry> = {}): MyPlaylistDbEntry {
  return {
    id,
    shareCode: `code-${id}`,
    title: `방 ${id}`,
    createdAt: "2026-10-01T00:00:00Z",
    teamName: null,
    coverThumbs: [],
    isMine: false,
    teamId: null,
    memberCount: 0,
    memberPreview: [],
    ...extra,
  };
}

/** Renders the page the way the server would: the async part behind Suspense is awaited too. */
async function renderHome(left = false) {
  const tree = (await Home({ searchParams: Promise.resolve(left ? { left: "1" } : {}) })) as ReactElement<{
    children?: ReactElement<Record<string, unknown>>;
    fallback?: ReactElement;
  }>;
  let content: ReactElement = tree;
  if (tree.type === Suspense) {
    const child = tree.props.children!;
    content = await (child.type as (props: unknown) => Promise<ReactElement>)(child.props);
  }
  render(content);
  return tree;
}

const hero = () => state.heroProps.at(-1)!;

beforeEach(() => {
  state.cookieNames = [SESSION_COOKIE];
  state.dismissedCookie = undefined;
  state.getCurrentUser.mockReset().mockResolvedValue(ME);
  state.getMyPlaylists.mockReset().mockResolvedValue({ playlists: [], failed: false });
  state.getMyTeams.mockReset().mockResolvedValue({ teams: [], failed: false });
  state.getHomeStats.mockReset().mockResolvedValue({ playlists: 40, users: 10, songs: 100 });
  state.heroProps = [];
});

afterEach(cleanup);

describe("home without a login cookie", () => {
  it("is the landing at once, with no skeleton and no Supabase Auth call (O4)", async () => {
    state.cookieNames = ["sb-abcdef-auth-token-code-verifier", "other"];
    const tree = await renderHome();
    expect(tree.type).not.toBe(Suspense);
    expect(hero().variant).toBe("landing");
    expect(screen.getByText(/5분 컷/)).toBeInTheDocument();
    expect(state.getCurrentUser).not.toHaveBeenCalled();
  });

  it("carries the site's structured data for search engines", async () => {
    state.cookieNames = [];
    await renderHome();
    const script = document.querySelector('script[type="application/ld+json"]');
    const types = JSON.parse(script!.textContent!)["@graph"].map((node: { "@type": string }) => node["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebApplication"]));
  });
});

describe("home with a login cookie", () => {
  it("leaves the structured data to the landing", async () => {
    await renderHome();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("sends the home skeleton first and checks the session behind it (DR10, O4)", async () => {
    const tree = await renderHome();
    expect(tree.type).toBe(Suspense);
    expect(tree.props.fallback?.type).toBe(HomeSkeleton);
  });

  it("falls back to the landing when the cookie outlived the session", async () => {
    state.cookieNames = [`${SESSION_COOKIE}.0`];
    state.getCurrentUser.mockResolvedValue(null);
    await renderHome();
    expect(hero().variant).toBe("landing");
    expect(state.getMyPlaylists).not.toHaveBeenCalled();
  });

  it("asks how to start when there is no band and no playlist (state A, DR2)", async () => {
    await renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("보컬님,어떻게 시작할까요?");
    expect(hero().variant).toBe("start");
    // Playlists kept on this device before login still show under the choices (DR15a).
    expect(screen.getByTestId("my-playlists")).toBeInTheDocument();
    expect(screen.queryByText(/단톡방에 링크를 보내면/)).not.toBeInTheDocument();
  });

  it("is state B for someone who only joined playlists, and offers only my band-less rooms with two members", async () => {
    state.getMyPlaylists.mockResolvedValue({
      playlists: [
        playlist("joined", { title: "보컬님의 합주" }),
        playlist("mine", { isMine: true, memberCount: 4, memberPreview: ["기타", "드럼", "베이스"] }),
        playlist("alone", { isMine: true, memberCount: 1 }),
        playlist("in-band", { isMine: true, memberCount: 5, teamId: "t-1" }),
      ],
      failed: false,
    });
    await renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("다음 합주곡 정해 볼까요?");
    expect(hero()).toMatchObject({
      variant: "row",
      participantOnlyTitle: "보컬님의 합주",
      bandCandidates: [{ id: "mine", title: "방 mine", memberCount: 4, memberPreview: ["기타", "드럼", "베이스"] }],
    });
  });

  it("stays in state B right after leaving a band, even with nothing left (DR15b)", async () => {
    await renderHome(true);
    expect(hero().variant).toBe("row");
    expect(screen.getByText(/단톡방에 링크를 보내면/)).toBeInTheDocument();
  });

  it.each([
    ["playlists", { playlists: { playlists: [], failed: true }, teams: { teams: [], failed: false } }],
    ["bands", { playlists: { playlists: [], failed: false }, teams: { teams: [], failed: true } }],
  ])("shows state B with a reload instead of the lists when the %s lookup fails (DR7)", async (_label, results) => {
    state.getMyPlaylists.mockResolvedValue(results.playlists);
    state.getMyTeams.mockResolvedValue(results.teams);
    await renderHome();
    expect(hero().variant).toBe("row");
    expect(screen.getByText("목록을 불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 불러오기" })).toHaveAttribute("href", "/");
    expect(screen.queryByTestId("my-bands")).not.toBeInTheDocument();
    expect(screen.queryByTestId("my-playlists")).not.toBeInTheDocument();
    expect(screen.queryByText(/단톡방에 링크를 보내면/)).not.toBeInTheDocument();
  });

  describe("home band card (DR4 · DR5 · DR6)", () => {
    const NEW = "11111111-0000-4000-8000-000000000001";
    const OLD = "11111111-0000-4000-8000-000000000002";
    const twoCandidates = {
      playlists: [
        playlist(NEW, { isMine: true, memberCount: 3, createdAt: "2026-10-05T00:00:00Z" }),
        playlist(OLD, { isMine: true, memberCount: 4, createdAt: "2026-09-01T00:00:00Z" }),
      ],
      failed: false,
    };
    const card = () => screen.queryByTestId("home-card");

    it("shows the newest playlist voted with others to an owner with no band", async () => {
      state.getMyPlaylists.mockResolvedValue(twoCandidates);
      await renderHome();
      expect(card()).toHaveAttribute("data-target", NEW);
    });

    it("shows nothing once that one was closed, never an older one instead", async () => {
      state.getMyPlaylists.mockResolvedValue(twoCandidates);
      state.dismissedCookie = NEW;
      await renderHome();
      expect(card()).not.toBeInTheDocument();
    });

    it("comes back for a newer candidate after an older one was closed", async () => {
      state.getMyPlaylists.mockResolvedValue(twoCandidates);
      state.dismissedCookie = OLD;
      await renderHome();
      expect(card()).toHaveAttribute("data-target", NEW);
    });

    it("is not for someone who already has a band", async () => {
      state.getMyPlaylists.mockResolvedValue(twoCandidates);
      state.getMyTeams.mockResolvedValue({ teams: [TEAM], failed: false });
      await renderHome();
      expect(card()).not.toBeInTheDocument();
    });

    it("is not shown when the bands could not be read", async () => {
      state.getMyPlaylists.mockResolvedValue(twoCandidates);
      state.getMyTeams.mockResolvedValue({ teams: [], failed: true });
      await renderHome();
      expect(card()).not.toBeInTheDocument();
    });
  });

  it("is state B with my band and lists", async () => {
    state.getMyTeams.mockResolvedValue({ teams: [TEAM], failed: false });
    await renderHome();
    expect(hero()).toMatchObject({ variant: "row", myTeams: [TEAM] });
    expect(screen.getByTestId("my-bands")).toBeInTheDocument();
  });
});
