// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BandPromptCard, { HomeBandCard } from "../BandPromptCard";
import { BAND_PROMPT_COOKIE } from "@/lib/prompt-dismissals";

vi.mock("@/actions/team", () => ({ createTeam: vi.fn(), createTeamFromPlaylist: vi.fn() }));
vi.mock("@/actions/member", () => ({ getVotingSettings: vi.fn().mockResolvedValue({ members: [] }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PLAYLIST = "22222222-2222-4222-8222-222222222222";
const PROMPT = /이 멤버 그대로 다음 공연도 해요/;

function clearCookie() {
  document.cookie = `${BAND_PROMPT_COOKIE}=; Path=/; Max-Age=0`;
}

beforeEach(clearCookie);
afterEach(() => {
  cleanup();
  clearCookie();
});

describe("BandPromptCard dismissal (DR6)", () => {
  it("closes from 안내 닫기 and stays closed on the next visit", () => {
    const first = render(<BandPromptCard playlistId={PLAYLIST} adminToken={null} dismissed={false} onCreated={() => {}} />);
    expect(screen.getByText(PROMPT)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();

    first.unmount();
    render(<BandPromptCard playlistId={PLAYLIST} adminToken={null} dismissed={false} onCreated={() => {}} />);
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("closing it on the playlist also closes the home card for the same playlist (DR5)", () => {
    const first = render(<BandPromptCard playlistId={PLAYLIST} adminToken={null} dismissed={false} onCreated={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    first.unmount();

    render(
      <HomeBandCard candidate={{ id: PLAYLIST, title: "10월 정기 합주", memberCount: 4, memberPreview: [] }} dismissed={false} />,
    );
    expect(screen.queryByText(/다음 공연도 같이 해요/)).not.toBeInTheDocument();
  });

  it("starts closed when the server already read the dismissal", () => {
    render(<BandPromptCard playlistId={PLAYLIST} adminToken={null} dismissed onCreated={() => {}} />);
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });
});
