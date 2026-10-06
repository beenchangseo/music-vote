// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getTeamInvite: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/actions/team", () => ({ getTeamInvite: state.getTeamInvite }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: state.getCurrentUser }));
vi.mock("@/components/BandInviteScreen", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

import JoinPage, { generateMetadata } from "../page";
import JoinNotFound from "../not-found";

const CODE = "aB3_x-9Zq0";
const TEAM = "11111111-1111-4111-8111-111111111111";
const props = (join?: string) => ({
  params: Promise.resolve({ inviteCode: CODE }),
  searchParams: Promise.resolve(join ? { join } : {}),
});

beforeEach(() => {
  state.getTeamInvite.mockReset();
  state.getCurrentUser.mockReset();
});

afterEach(cleanup);

describe("/join/[inviteCode]", () => {
  it("is not found for an unknown or rotated code", async () => {
    state.getTeamInvite.mockResolvedValue(null);
    await expect(JoinPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a member to the band home", async () => {
    state.getTeamInvite.mockResolvedValue({ status: "member", teamId: TEAM, name: "일코해제" });
    await expect(JoinPage(props())).rejects.toThrow(`NEXT_REDIRECT /band/${TEAM}`);
  });

  it("passes ?join=1 through as a flag only; nothing joins during the server render", async () => {
    state.getTeamInvite.mockResolvedValue({
      status: "invite",
      loggedIn: true,
      name: "일코해제",
      memberCount: 4,
      previewNames: ["보컬", "기타", "드럼"],
      nextShowAt: "2026-10-16",
    });
    const element = (await JoinPage(props("1"))) as ReactElement<{ joinRequested: boolean; code: string }>;
    expect(element.props.joinRequested).toBe(true);
    expect(element.props.code).toBe(CODE);
  });

  it("unfurls the link like the band card and stays out of search", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
    state.getTeamInvite.mockResolvedValue({
      status: "invite",
      loggedIn: false,
      name: "일코해제",
      memberCount: 4,
      previewNames: [],
      nextShowAt: "2026-10-16",
    });
    const meta = await generateMetadata(props());
    vi.useRealTimers();
    expect(meta.title).toBe("일코해제 · Plypick");
    expect(meta.description).toBe("10월 16일(금) 공연 · 멤버 4명");
    expect(meta.robots).toEqual({ index: false });
    const image = String((meta.openGraph?.images as string[])[0]);
    expect(image).toContain("variant=band");
    expect(image).toContain("date=2026-10-16");
  });
});

describe("/join/[inviteCode] card for a band of one (DR13)", () => {
  it("names the owner and leaves the member count off the image", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
    state.getTeamInvite.mockResolvedValue({
      status: "invite",
      loggedIn: false,
      name: "일코해제",
      memberCount: 1,
      previewNames: ["보컬"],
      nextShowAt: null,
    });
    const meta = await generateMetadata(props());
    vi.useRealTimers();
    expect(meta.description).toBe("보컬님이 밴드를 만들었어요 · 카카오 로그인 한 번이면 합류");
  });
});

describe("/join/[inviteCode] not-found", () => {
  it("tells a logged-out visitor to ask for a new link", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    render(await JoinNotFound());
    expect(screen.getByRole("heading", { name: "이 초대 링크는 더 이상 쓸 수 없어요" })).toBeInTheDocument();
    expect(screen.getByText("밴드 멤버에게 새 링크를 받아 주세요")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "내 밴드 보기" })).not.toBeInTheDocument();
  });

  it("adds the 'my bands' way back for a logged-in visitor", async () => {
    state.getCurrentUser.mockResolvedValue({ id: "u1", nickname: "보컬", avatarUrl: null });
    render(await JoinNotFound());
    expect(screen.getByText(/이미 멤버라면 홈의 .내 밴드.에서 들어갈 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 밴드 보기" })).toHaveAttribute("href", "/#my-bands");
  });
});
