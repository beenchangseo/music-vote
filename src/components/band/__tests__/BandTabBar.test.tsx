// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaylistPick } from "@/domain/playlist-picker";
import type { PlaylistStage } from "@/domain/playlist-stage";
import BandTabBar from "../BandTabBar";

const TEAM = "11111111-1111-4111-8111-111111111111";

const pick = (shareCode: string, title: string, stage: PlaylistStage, createdAt: string): PlaylistPick => ({
  shareCode,
  title,
  stage,
  createdAt,
});

const DEC = pick("dec", "연말 파티 곡", "voting", "2026-11-08T10:00:00Z");
const NOV = pick("nov", "11월 정기공연 후보곡", "building", "2026-11-01T10:00:00Z");
const OCT = pick("oct", "10월 합주", "confirmed", "2026-10-05T10:00:00Z");
const SEP = pick("sep", "9월 버스킹", "closed", "2026-09-08T10:00:00Z");
/** Confirmed after the running ones were made, so a newest-first order alone would put it first. */
const XMAS = pick("xmas", "크리스마스 공연 셋", "confirmed", "2026-11-10T10:00:00Z");

const nav = (name: string) => screen.getByRole("navigation", { name });
const tabsOf = (bar: HTMLElement) =>
  [...bar.querySelectorAll("a, button")].map((tab) => [tab.textContent, tab.getAttribute("href") ?? (tab.getAttribute("aria-current") ? "current" : "button")]);
const picker = () => screen.getByRole("dialog", { name: "플레이리스트" });
const rowsOf = (dialog: HTMLElement) =>
  within(dialog)
    .getAllByRole("listitem")
    .map((row) => row.textContent);

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BandTabBar on band home (#110)", () => {
  it("has 밴드 홈 (current) · 플레이리스트 · 만들기, and 만들기 makes a playlist in this band", () => {
    render(<BandTabBar screen="band-home" band={{ id: TEAM, playlists: [DEC, OCT] }} />);
    expect(tabsOf(nav("밴드 화면"))).toEqual([
      ["밴드 홈", "current"],
      ["플레이리스트", "/playlist/dec"],
      ["만들기", `/new?band=${TEAM}`],
    ]);
    fireEvent.click(within(nav("밴드 화면")).getByRole("button", { name: "밴드 홈" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("goes straight to the one running playlist, even when a finished one is newer", () => {
    render(<BandTabBar screen="band-home" band={{ id: TEAM, playlists: [pick("new", "새 셋", "confirmed", "2026-11-09T00:00:00Z"), NOV] }} />);
    expect(within(nav("밴드 화면")).getByRole("link", { name: "플레이리스트" })).toHaveAttribute("href", "/playlist/nov");
  });

  it("says 플레이리스트 opens a dialog only when it opens the picker, never on 밴드 홈", () => {
    render(<BandTabBar screen="band-home" band={{ id: TEAM, playlists: [DEC, NOV] }} />);
    const bar = nav("밴드 화면");
    expect(within(bar).getByRole("button", { name: "플레이리스트" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(bar).getByRole("button", { name: "밴드 홈" })).not.toHaveAttribute("aria-haspopup");
  });

  it("opens a picker with the running ones first, then the rest, newest first, each with its stage", () => {
    render(<BandTabBar screen="band-home" band={{ id: TEAM, playlists: [XMAS, OCT, NOV, SEP, DEC] }} />);
    fireEvent.click(within(nav("밴드 화면")).getByRole("button", { name: "플레이리스트" }));

    expect(rowsOf(picker())).toEqual([
      expect.stringMatching(/^연말 파티 곡.*투표 중/),
      expect.stringMatching(/^11월 정기공연 후보곡.*셋리스트 짜는 중/),
      expect.stringMatching(/^크리스마스 공연 셋.*셋리스트 확정/),
      expect.stringMatching(/^10월 합주.*셋리스트 확정/),
      expect.stringMatching(/^9월 버스킹.*마감/),
    ]);
    expect(within(picker()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/playlist/dec",
      "/playlist/nov",
      "/playlist/xmas",
      "/playlist/oct",
      "/playlist/sep",
    ]);
    expect(within(picker()).queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("opens a picker that points to 만들기 when the band has no playlist, with no create button of its own", () => {
    render(<BandTabBar screen="band-home" band={{ id: TEAM, playlists: [] }} />);
    fireEvent.click(within(nav("밴드 화면")).getByRole("button", { name: "플레이리스트" }));

    expect(picker()).toHaveTextContent("아직 플레이리스트가 없어요");
    expect(picker()).toHaveTextContent("아래 ＋ 만들기로 첫 플레이리스트를 만들어요");
    expect(within(picker()).queryAllByRole("link")).toHaveLength(0);
    expect(within(picker()).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["닫기"]);
  });
});

describe("BandTabBar inside a band playlist (#110)", () => {
  it("has 밴드 홈 to the band · 플레이리스트 (current) · 만들기 in this band", () => {
    render(<BandTabBar screen="playlist" shareCode="nov" band={{ id: TEAM, playlists: [DEC, NOV] }} />);
    expect(tabsOf(nav("플레이리스트 화면"))).toEqual([
      ["밴드 홈", `/band/${TEAM}`],
      ["플레이리스트", "current"],
      ["만들기", `/new?band=${TEAM}`],
    ]);
  });

  it("opens the same picker with this playlist checked, to switch to another one", () => {
    render(<BandTabBar screen="playlist" shareCode="nov" band={{ id: TEAM, playlists: [OCT, NOV, DEC] }} />);
    const tab = within(nav("플레이리스트 화면")).getByRole("button", { name: "플레이리스트" });
    expect(tab).toHaveAttribute("aria-current", "page");
    expect(tab).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(tab);

    const rows = within(picker()).getAllByRole("listitem");
    expect(rowsOf(picker())[1]).toMatch(/^11월 정기공연 후보곡/);
    expect(rows[1]).toHaveAttribute("aria-current", "page");
    expect(within(rows[1]).queryByRole("link")).not.toBeInTheDocument();
    expect(within(picker()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/playlist/dec", "/playlist/oct"]);
  });

  it("says so in the picker when the band's playlists could not be read", () => {
    render(<BandTabBar screen="playlist" shareCode="nov" band={{ id: TEAM, playlists: null }} />);
    fireEvent.click(within(nav("플레이리스트 화면")).getByRole("button", { name: "플레이리스트" }));
    expect(picker()).toHaveTextContent("플레이리스트 목록을 불러오지 못했어요");
  });
});

describe("BandTabBar for a viewer without the band (#106 rule, #110)", () => {
  it("has 홈 to the app home · 플레이리스트 (current, back to the top) · 만들기, and shows no band", () => {
    render(<BandTabBar screen="playlist" shareCode="nov" band={null} />);
    const bar = nav("플레이리스트 화면");
    expect(tabsOf(bar)).toEqual([
      ["홈", "/"],
      ["플레이리스트", "current"],
      ["만들기", "/new"],
    ]);

    expect(within(bar).getByRole("button", { name: "플레이리스트" })).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(within(bar).getByRole("button", { name: "플레이리스트" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("/band/");
  });
});
