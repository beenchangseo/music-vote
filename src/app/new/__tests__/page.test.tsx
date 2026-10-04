// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMyPlaylists: vi.fn(),
  getMyTeams: vi.fn(),
  getTeamHome: vi.fn(),
  formProps: [] as unknown[],
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: state.getCurrentUser }));
vi.mock("@/actions/playlist", () => ({ getMyPlaylists: state.getMyPlaylists }));
vi.mock("@/actions/team", () => ({ getMyTeams: state.getMyTeams, getTeamHome: state.getTeamHome }));
vi.mock("@/components/MyPlaylists", () => ({ default: () => null }));
vi.mock("@/components/CreatePlaylistForm", () => ({
  default: (props: unknown) => {
    state.formProps.push(props);
    return <form aria-label="합주방 만들기 폼" />;
  },
}));
vi.mock("@/components/LoginButton", () => ({
  default: ({ next }: { next: string }) => (
    <button type="button" data-next={next}>
      카카오로 시작하기
    </button>
  ),
}));

import NewPlaylistPage from "../page";

const TEAM = "11111111-1111-4111-8111-111111111111";
const ME = { id: "u1", nickname: "보컬", avatarUrl: null };
const props = (band?: string) => ({ searchParams: Promise.resolve(band ? { band } : {}) });

beforeEach(() => {
  state.getCurrentUser.mockReset().mockResolvedValue(ME);
  state.getMyPlaylists.mockReset().mockResolvedValue([]);
  state.getMyTeams.mockReset().mockResolvedValue([]);
  state.getTeamHome.mockReset();
  state.formProps = [];
});

afterEach(cleanup);

describe("/new?band=", () => {
  it("shows the band label and creates inside the band for a member", async () => {
    state.getMyTeams.mockResolvedValue([{ id: TEAM, name: "일코해제", nextShowAt: "2026-10-16", role: "member", roomCount: 2 }]);
    render(await NewPlaylistPage(props(TEAM)));
    expect(screen.getByText("일코해제의 합주방")).toBeInTheDocument();
    // 17A: a label, not a control.
    expect(screen.queryByRole("button", { name: /일코해제/ })).not.toBeInTheDocument();
    expect(state.formProps[0]).toMatchObject({ band: { id: TEAM, name: "일코해제", nextShowAt: "2026-10-16" } });
    expect(state.getTeamHome).not.toHaveBeenCalled();
  });

  it("refuses a non-member without offering an invite", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: true, team: { id: TEAM, name: "일코해제" } });
    render(await NewPlaylistPage(props(TEAM)));
    expect(screen.getByText("밴드 멤버만 만들 수 있어요")).toBeInTheDocument();
    // Top bar link + the one under the message.
    expect(screen.getAllByRole("link", { name: "홈으로" })).toHaveLength(2);
    expect(screen.queryByRole("form", { name: "합주방 만들기 폼" })).not.toBeInTheDocument();
    expect(screen.queryByText(/초대/)).not.toBeInTheDocument();
  });

  it("says the band is missing for an unknown id", async () => {
    state.getTeamHome.mockResolvedValue(null);
    render(await NewPlaylistPage(props("not-a-band")));
    expect(screen.getByText("밴드를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "합주방 만들기 폼" })).not.toBeInTheDocument();
  });

  it("keeps ?band= through login", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    render(await NewPlaylistPage(props(TEAM)));
    expect(screen.getByRole("button", { name: "카카오로 시작하기" })).toHaveAttribute("data-next", `/new?band=${TEAM}`);
    expect(state.getMyTeams).not.toHaveBeenCalled();
  });

  it("passes my bands to the plain form for the completion screen (13A)", async () => {
    const mine = [{ id: TEAM, name: "일코해제", nextShowAt: null, role: "owner", roomCount: 1 }];
    state.getMyTeams.mockResolvedValue(mine);
    render(await NewPlaylistPage(props()));
    expect(state.formProps[0]).toMatchObject({ band: null, myTeams: mine });
    expect(screen.queryByText("일코해제의 합주방")).not.toBeInTheDocument();
  });
});
