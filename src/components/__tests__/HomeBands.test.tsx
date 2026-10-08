// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HeroCTA from "../HeroCTA";
import { HomeBandCard } from "../BandPromptCard";
import LeftBandNotice, { LEFT_BAND_STORAGE_KEY } from "../LeftBandNotice";
import MyBands from "../MyBands";
import MyPlaylists from "../MyPlaylists";

const replace = vi.fn();
const triggerKakaoLogin = vi.hoisted(() => vi.fn());
const bandSheet = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/kakao-login", () => ({ triggerKakaoLogin }));
vi.mock("../CreatePlaylistForm", () => ({ default: () => <form aria-label="플레이리스트 만들기 폼" /> }));
vi.mock("../CreateBandSheet", () => ({
  default: (props: Record<string, unknown>) => {
    bandSheet.props.push(props);
    return props.open ? <div role="dialog" aria-label="밴드 만들기" /> : null;
  },
}));

const TEAM = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  replace.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("HeroCTA (CEO2-A, DR2, DR3)", () => {
  const signedIn = { myTeams: [], bandCandidates: [], participantOnlyTitle: null };

  it("brings a new visitor back to the home after Kakao login, not to /new", () => {
    render(<HeroCTA variant="landing" />);
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    expect(triggerKakaoLogin).toHaveBeenCalledWith("/");
  });

  it("gives state A two choices, each with what it means", () => {
    bandSheet.props = [];
    render(<HeroCTA variant="start" {...signedIn} />);
    expect(screen.getByText("멤버를 한 번 모아 두면 공연마다 바로 투표해요")).toBeInTheDocument();
    expect(screen.getByText("플레이리스트 링크를 단톡방에 보내요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "밴드로 시작하기" }));
    expect(screen.getByRole("dialog", { name: "밴드 만들기" })).toBeInTheDocument();
    expect(bandSheet.props.at(-1)).toMatchObject({ mode: "home", source: "home" });

    fireEvent.click(screen.getByRole("button", { name: "이번 합주곡만 정하기" }));
    expect(screen.getByRole("form", { name: "플레이리스트 만들기 폼" })).toBeInTheDocument();
  });

  it("puts 새 밴드 next to 새 플레이리스트 in state B and hands the candidates to the sheet", () => {
    bandSheet.props = [];
    const candidate = { id: "pl-1", title: "10월 합주", memberCount: 3, memberPreview: ["기타", "드럼"] };
    render(<HeroCTA variant="row" {...signedIn} bandCandidates={[candidate]} participantOnlyTitle="남의 합주" />);
    expect(screen.getByRole("button", { name: "새 플레이리스트" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "새 밴드" }));
    expect(bandSheet.props.at(-1)).toMatchObject({ open: true, candidates: [candidate], participantOnlyTitle: "남의 합주" });
  });
});

describe("HomeBandCard (DR5)", () => {
  const candidate = { id: "33333333-3333-4333-8333-333333333333", title: "10월 정기 합주", memberCount: 4, memberPreview: ["기타", "드럼", "베이스"] };

  beforeEach(() => {
    document.cookie = "plypick_band_prompt_dismissed=; Path=/; Max-Age=0";
  });

  it("names the playlist and its members and opens the band sheet for it", () => {
    bandSheet.props = [];
    render(<HomeBandCard candidate={candidate} dismissed={false} />);
    expect(screen.getByText("「10월 정기 합주」")).toBeInTheDocument();
    expect(screen.getByText(/멤버 4명, 다음 공연도 같이 해요\?/)).toBeInTheDocument();
    expect(screen.getByText("기타, 드럼, 베이스")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이 멤버로 밴드 만들기" }));
    expect(bandSheet.props.at(-1)).toMatchObject({ open: true, mode: "home", source: "home_card", target: candidate });
  });

  it("closes with a 44px button and remembers it for that playlist (shared with the playlist card)", () => {
    render(<HomeBandCard candidate={candidate} dismissed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText("「10월 정기 합주」")).not.toBeInTheDocument();
    expect(document.cookie).toContain(candidate.id);
  });
});

describe("LeftBandNotice (디자인 2회차 6A)", () => {
  it("says which band was left, once, and strips ?left=1", () => {
    window.sessionStorage.setItem(LEFT_BAND_STORAGE_KEY, "일코해제");
    render(<LeftBandNotice left />);
    expect(screen.getByRole("status")).toHaveTextContent("일코해제에서 나왔어요");
    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
    expect(window.sessionStorage.getItem(LEFT_BAND_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falls back to a plain line when the name is missing or storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<LeftBandNotice left />);
    expect(screen.getByRole("status")).toHaveTextContent("밴드에서 나왔어요");
  });

  it("stays silent without ?left=1", () => {
    window.sessionStorage.setItem(LEFT_BAND_STORAGE_KEY, "일코해제");
    render(<LeftBandNotice left={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("MyBands (4A)", () => {
  it("is hidden without bands", () => {
    const { container } = render(<MyBands teams={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one row per band with the D-day and the room count", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
    render(
      <MyBands
        teams={[
          { id: TEAM, name: "일코해제", nextShowAt: "2026-10-16", role: "owner", roomCount: 3 },
          { id: "22222222-2222-4222-8222-222222222222", name: "산울림", nextShowAt: "2026-10-01", role: "member", roomCount: 1 },
        ]}
      />,
    );
    const first = screen.getByRole("link", { name: /일코해제/ });
    expect(first).toHaveAttribute("href", `/band/${TEAM}`);
    expect(first).toHaveTextContent("공연 D-12");
    expect(first).toHaveTextContent("플레이리스트 3");
    // A past show is not shown on the home line.
    expect(screen.getByRole("link", { name: /산울림/ })).not.toHaveTextContent("공연");
  });
});

describe("MyPlaylists band caption", () => {
  it("marks band rooms with the band name", () => {
    render(
      <MyPlaylists
        dbPlaylists={[
          { id: "r1", shareCode: "abc", title: "10월 합주", teamName: "일코해제" },
          { id: "r2", shareCode: "def", title: "번개 합주", teamName: null },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /10월 합주/ })).toHaveTextContent("일코해제");
    expect(screen.getByRole("link", { name: /번개 합주/ })).not.toHaveTextContent("일코해제");
  });
});
