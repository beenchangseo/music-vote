// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { Suspense, type ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ getTeamHome: vi.fn(), teamExists: vi.fn(), getMyTeams: vi.fn() }));

vi.mock("@/actions/team", () => ({ getTeamHome: state.getTeamHome, teamExists: state.teamExists, getMyTeams: state.getMyTeams }));
vi.mock("@/components/band/BandHomeClient", () => ({ default: () => null }));
vi.mock("@/components/auth/LoginButton", () => ({
  default: ({ label, next }: { label: string; next: string }) => (
    <button type="button" data-next={next}>
      {label}
    </button>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import BandPage, { generateMetadata } from "../page";
import BandHomeSkeleton from "@/components/band/BandHomeSkeleton";

const TEAM = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const props = (query: Record<string, string> = {}) => ({
  params: Promise.resolve({ teamId: TEAM }),
  searchParams: Promise.resolve(query),
});

beforeEach(() => {
  state.getTeamHome.mockReset();
  state.teamExists.mockReset().mockResolvedValue(true);
  state.getMyTeams.mockReset().mockResolvedValue({ teams: [], failed: false });
});
afterEach(cleanup);

type Boundary = ReactElement<{ fallback: ReactElement; children: ReactElement<Record<string, unknown>> }>;

/** The page as the server streams it: the band check, then the body behind Suspense. */
async function page(query: Record<string, string> = {}) {
  const tree = (await BandPage(props(query))) as Boundary;
  expect(tree.type).toBe(Suspense);
  const body = tree.props.children;
  return { tree, content: await (body.type as (p: unknown) => Promise<ReactElement>)(body.props) };
}

describe("/band/[teamId]", () => {
  it("answers 404 for an unknown band before anything streams", async () => {
    state.teamExists.mockResolvedValue(false);
    state.getTeamHome.mockResolvedValue(null);
    // notFound() is thrown by the page itself, not inside the Suspense boundary, so the status can still be 404.
    await expect(BandPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.teamExists).toHaveBeenCalledWith(TEAM);
  });

  it("does not wait for the existence check to start reading the band", async () => {
    let resolveExists: (value: boolean) => void = () => {};
    state.teamExists.mockReturnValue(new Promise((r) => (resolveExists = r)));
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: false, team: { id: TEAM, name: "일코해제" } });
    const pending = BandPage(props());
    await Promise.resolve();
    await Promise.resolve();
    expect(state.getTeamHome).toHaveBeenCalledWith(TEAM);
    resolveExists(true);
    await pending;
  });

  it("streams the band home behind its skeleton", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: false, team: { id: TEAM, name: "일코해제" } });
    const { tree } = await page();
    expect(tree.props.fallback.type).toBe(BandHomeSkeleton);
  });

  it("asks a logged-out visitor to log in and come back to the same band", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: false, team: { id: TEAM, name: "일코해제" } });
    render((await page()).content);
    expect(screen.getByRole("heading", { level: 1, name: "일코해제" })).toBeInTheDocument();
    expect(screen.getByText("밴드 멤버만 볼 수 있어요")).toBeInTheDocument();
    expect(screen.getByText("멤버라면 로그인하면 바로 들어가요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카카오로 로그인" })).toHaveAttribute("data-next", `/band/${TEAM}`);
  });

  it("tells a logged-in non-member to ask for an invite link, with no invite of its own", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: true, team: { id: TEAM, name: "일코해제" } });
    render((await page()).content);
    expect(screen.getByText("들어가려면 밴드 멤버에게 초대 링크를 받아 주세요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/join/)).not.toBeInTheDocument();
  });

  it.each([
    ["a logged-out visitor", false],
    ["a logged-in non-member", true],
  ])("gives %s no tab bar (#106)", async (_who, loggedIn) => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn, team: { id: TEAM, name: "일코해제" } });
    render((await page()).content);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  // docs/adr/0011: the switcher sheet draws a name and a band link, so that is all that reaches the browser.
  it("hands the member screen my bands as ids and names only", async () => {
    state.getTeamHome.mockResolvedValue({ access: "member", myRole: "member", team: { id: TEAM, name: "일코해제" } });
    state.getMyTeams.mockResolvedValue({
      teams: [
        { id: OTHER, name: "목요일 잼", nextShowAt: "2026-11-23", role: "owner", roomCount: 2 },
        { id: TEAM, name: "일코해제", nextShowAt: null, role: "member", roomCount: 1 },
      ],
      failed: false,
    });
    const element = (await page()).content as ReactElement<{ bands: unknown }>;
    expect(element.props.bands).toStrictEqual([
      { id: OTHER, name: "목요일 잼" },
      { id: TEAM, name: "일코해제" },
    ]);
  });

  it("still lists this band when my bands could not be read", async () => {
    state.getTeamHome.mockResolvedValue({ access: "member", myRole: "member", team: { id: TEAM, name: "일코해제" } });
    state.getMyTeams.mockResolvedValue({ teams: [], failed: true });
    const element = (await page()).content as ReactElement<{ bands: unknown }>;
    expect(element.props.bands).toStrictEqual([{ id: TEAM, name: "일코해제" }]);
  });

  it("passes the one-time banner flags to the member screen", async () => {
    state.getTeamHome.mockResolvedValue({ access: "member", myRole: "owner", team: { id: TEAM, name: "일코해제" } });
    const element = (await page({ created: "1" })).content as ReactElement<{ created: boolean; joined: boolean }>;
    expect(element.props.created).toBe(true);
    expect(element.props.joined).toBe(false);
  });

  it("keeps band pages out of search", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: false, team: { id: TEAM, name: "일코해제" } });
    await expect(generateMetadata(props())).resolves.toMatchObject({
      title: "일코해제 · Plypick",
      robots: { index: false },
    });
  });
});
