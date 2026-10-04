// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ getTeamHome: vi.fn() }));

vi.mock("@/actions/team", () => ({ getTeamHome: state.getTeamHome }));
vi.mock("@/components/BandHomeClient", () => ({ default: () => null }));
vi.mock("@/components/LoginButton", () => ({
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

const TEAM = "11111111-1111-4111-8111-111111111111";
const props = (query: Record<string, string> = {}) => ({
  params: Promise.resolve({ teamId: TEAM }),
  searchParams: Promise.resolve(query),
});

beforeEach(() => state.getTeamHome.mockReset());
afterEach(cleanup);

describe("/band/[teamId]", () => {
  it("is not found for an unknown band", async () => {
    state.getTeamHome.mockResolvedValue(null);
    await expect(BandPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("asks a logged-out visitor to log in and come back to the same band", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: false, team: { id: TEAM, name: "일코해제" } });
    render(await BandPage(props()));
    expect(screen.getByRole("heading", { level: 1, name: "일코해제" })).toBeInTheDocument();
    expect(screen.getByText("밴드 멤버만 볼 수 있어요")).toBeInTheDocument();
    expect(screen.getByText("멤버라면 로그인하면 바로 들어가요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카카오로 로그인" })).toHaveAttribute("data-next", `/band/${TEAM}`);
  });

  it("tells a logged-in non-member to ask for an invite link, with no invite of its own", async () => {
    state.getTeamHome.mockResolvedValue({ access: "guest", loggedIn: true, team: { id: TEAM, name: "일코해제" } });
    render(await BandPage(props()));
    expect(screen.getByText("들어가려면 밴드 멤버에게 초대 링크를 받아 주세요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/join/)).not.toBeInTheDocument();
  });

  it("passes the one-time banner flags to the member screen", async () => {
    state.getTeamHome.mockResolvedValue({ access: "member", myRole: "owner", team: { id: TEAM, name: "일코해제" } });
    const element = (await BandPage(props({ created: "1" }))) as ReactElement<{ created: boolean; joined: boolean }>;
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
