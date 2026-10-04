// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamHomeView, TeamRoom } from "@/actions/team";
import BandHomeClient from "../BandHomeClient";

const actions = vi.hoisted(() => ({
  leaveTeam: vi.fn(),
  removeTeamMember: vi.fn(),
  regenerateInviteCode: vi.fn(),
  updateTeamNextShow: vi.fn(),
}));
const replace = vi.fn();
const push = vi.fn();
const showDanger = vi.fn();

vi.mock("@/actions/team", () => actions);
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh: vi.fn() }) }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showDanger, showAlert: vi.fn(), showConfirm: vi.fn() }) }));

type MemberView = Extract<TeamHomeView, { access: "member" }>;
const TEAM = "11111111-1111-4111-8111-111111111111";

function room(overrides: Partial<TeamRoom> = {}): TeamRoom {
  return {
    id: "room-1",
    shareCode: "abc123",
    title: "10월 정기 합주",
    createdAt: "2026-10-01T03:00:00Z",
    setlistConfirmed: false,
    setlist: [],
    ...overrides,
  };
}

function view(overrides: Partial<MemberView> = {}, team: Partial<MemberView["team"]> = {}): MemberView {
  return {
    access: "member",
    myRole: "member",
    team: { id: TEAM, name: "일코해제", inviteCode: "OLDcode_01", nextShowAt: null, createdAt: "2026-09-01T00:00:00Z", ...team },
    members: [
      { userId: null, displayName: "보컬", role: "owner", joinedAt: "2026-09-01T00:00:00Z", isMe: false },
      { userId: null, displayName: "기타", role: "member", joinedAt: "2026-09-02T00:00:00Z", isMe: true },
    ],
    rooms: [],
    ...overrides,
  };
}

const ownerView = (overrides: Partial<MemberView> = {}) =>
  view({
    myRole: "owner",
    members: [
      { userId: "u-owner", displayName: "보컬", role: "owner", joinedAt: "2026-09-01T00:00:00Z", isMe: true },
      { userId: "u-guitar", displayName: "기타", role: "member", joinedAt: "2026-09-02T00:00:00Z", isMe: false },
    ],
    ...overrides,
  });

function renderHome(v: MemberView, flags: { created?: boolean; joined?: boolean } = {}) {
  return render(<BandHomeClient view={v} created={!!flags.created} joined={!!flags.joined} />);
}

beforeEach(() => {
  // 2026-10-04 12:00 KST
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
  for (const fn of Object.values(actions)) fn.mockReset();
  replace.mockReset();
  push.mockReset();
  showDanger.mockReset().mockResolvedValue(true);
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BandHomeClient leave row (디자인 2회차 1A·5A·6A·8A)", () => {
  it("is not rendered for the owner", () => {
    renderHome(ownerView());
    expect(screen.queryByRole("button", { name: "밴드 나가기" })).not.toBeInTheDocument();
  });

  it("asks with the band name and a 나가기 button, then goes home with the name stored", async () => {
    actions.leaveTeam.mockResolvedValue({ success: true });
    renderHome(view());
    fireEvent.click(screen.getByRole("button", { name: "밴드 나가기" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/?left=1"));
    expect(showDanger).toHaveBeenCalledWith(expect.stringContaining("이미 들어간 합주방은 그대로 남아요"), {
      title: "일코해제에서 나갈까요?",
      confirmLabel: "나가기",
    });
    expect(actions.leaveTeam).toHaveBeenCalledWith(TEAM);
    expect(window.sessionStorage.getItem("plypick:left-band")).toBe("일코해제");
  });

  it("does nothing when the confirm is cancelled", async () => {
    showDanger.mockResolvedValue(false);
    renderHome(view());
    fireEvent.click(screen.getByRole("button", { name: "밴드 나가기" }));
    await waitFor(() => expect(showDanger).toHaveBeenCalled());
    expect(actions.leaveTeam).not.toHaveBeenCalled();
  });

  it("shows the failure under the row", async () => {
    actions.leaveTeam.mockResolvedValue({ success: false, reason: "owner_cannot_leave" });
    renderHome(view());
    fireEvent.click(screen.getByRole("button", { name: "밴드 나가기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("밴드를 만든 사람은 나갈 수 없어요");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("BandHomeClient banners (11A)", () => {
  it("shows the created banner once and strips the query on first mount", () => {
    renderHome(ownerView(), { created: true });
    expect(screen.getByRole("status")).toHaveTextContent("밴드를 만들었어요. 멤버 2명이 함께해요");
    expect(replace).toHaveBeenCalledWith(`/band/${TEAM}`, { scroll: false });
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "카톡으로 알리기" }));
    expect(screen.getByRole("dialog", { name: "멤버 초대" })).toBeInTheDocument();
  });

  it("welcomes a new member and points at the running room", () => {
    renderHome(view({ rooms: [room()] }), { joined: true });
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("일코해제 밴드에 들어왔어요");
    expect(within(banner).getByRole("link", { name: "지금 합주방 가기" })).toHaveAttribute("href", "/playlist/abc123");
  });

  it("does not touch the address without a banner query", () => {
    renderHome(view());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("BandHomeClient primary action (1A)", () => {
  it("asks a lone owner to call members", () => {
    renderHome(ownerView({ members: [ownerView().members[0]] }));
    expect(screen.getByRole("button", { name: "카톡으로 멤버 부르기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 합주방" })).toHaveAttribute("href", `/new?band=${TEAM}`);
  });

  it("puts the running room first with 새 합주방 as secondary", () => {
    renderHome(view({ rooms: [room()] }));
    expect(screen.getByRole("link", { name: /지금 합주방/ })).toHaveAttribute("href", "/playlist/abc123");
    expect(screen.getByRole("link", { name: "새 합주방" })).toHaveAttribute("href", `/new?band=${TEAM}`);
  });

  it("falls back to 새 합주방 when nothing is running", () => {
    renderHome(view({ rooms: [room({ setlistConfirmed: true })] }));
    expect(screen.queryByRole("link", { name: /지금 합주방/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 합주방" })).toBeInTheDocument();
  });
});

describe("BandHomeClient rooms (26A, E1)", () => {
  const played = [
    { songId: "s1", title: "말달리자", artist: "크라잉넛", position: 0 },
    { songId: "s2", title: "넌 내게 반했어", artist: "노브레인", position: 1 },
  ];

  it("lists rooms with counts and opens only the latest setlist", () => {
    renderHome(
      view({
        rooms: [
          room({ id: "r2", title: "10월 합주", setlist: played }),
          room({ id: "r1", title: "9월 합주", shareCode: "old", setlist: [played[0]], setlistConfirmed: true }),
        ],
      }),
    );
    expect(screen.getByRole("heading", { name: /합주방\s*2/ })).toBeInTheDocument();
    expect(screen.getByText("했던 곡 3")).toBeInTheDocument();
    expect(screen.getByText("넌 내게 반했어")).toBeInTheDocument();
    const older = screen.getByRole("button", { name: "9월 합주 곡 기록 펼치기" });
    expect(older).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(older);
    expect(screen.getByRole("button", { name: "9월 합주 곡 기록 접기" })).toHaveAttribute("aria-expanded", "true");
  });

  it("tells members where the history will appear", () => {
    renderHome(view({ rooms: [room()] }));
    expect(screen.getByText("셋리스트를 짜면 여기에 쌓여요")).toBeInTheDocument();
  });

  it("shows five rooms and a 더 보기 for the rest", () => {
    const rooms = Array.from({ length: 7 }, (_, i) => room({ id: `r${i}`, shareCode: `c${i}`, title: `합주 ${i}` }));
    renderHome(view({ rooms }));
    expect(screen.queryByText("합주 6")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "더 보기 (2개)" }));
    expect(screen.getByText("합주 6")).toBeInTheDocument();
  });
});

describe("BandHomeClient show date (E2, 8A)", () => {
  it("offers to set a date when there is none", () => {
    renderHome(view());
    expect(screen.getByRole("button", { name: "공연 날짜 정하기" })).toBeInTheDocument();
  });

  it("reads the tile as one line", () => {
    renderHome(view({}, { nextShowAt: "2026-10-16" }));
    expect(screen.getByRole("button", { name: "공연 10월 16일 금요일, 12일 남음" })).toBeInTheDocument();
  });

  it("thanks the band the day after the show and offers the next date", () => {
    renderHome(view({}, { nextShowAt: "2026-10-03" }));
    expect(screen.getByText("10월 3일 공연 끝 · 수고했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 공연 날짜 정하기" })).toBeInTheDocument();
  });

  it("goes back to the empty state on day 15", () => {
    renderHome(view({}, { nextShowAt: "2026-09-19" }));
    expect(screen.getByRole("button", { name: "공연 날짜 정하기" })).toBeInTheDocument();
  });
});

describe("BandHomeClient member management (F1, 24B, R7)", () => {
  it("lets the owner remove a member with the link rotation off by default", async () => {
    actions.removeTeamMember.mockResolvedValue({ success: true, inviteCode: null });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "내보내기" }));

    const dialog = screen.getByRole("dialog", { name: "기타님을 밴드에서 내보낼까요?" });
    const checkbox = within(dialog).getByRole("checkbox", { name: /초대 링크도 새로 만들기/ });
    expect(checkbox).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "내보내기" }));

    await waitFor(() => expect(actions.removeTeamMember).toHaveBeenCalledWith(TEAM, "u-guitar", false));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("기타")).not.toBeInTheDocument();
  });

  it("shows the new invite link after removing with rotation, without moving the band address", async () => {
    actions.removeTeamMember.mockResolvedValue({ success: true, inviteCode: "NEWcode_02" });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "내보내기" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /초대 링크도 새로 만들기/ }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));

    await waitFor(() => expect(actions.removeTeamMember).toHaveBeenCalledWith(TEAM, "u-guitar", true));
    const sheet = await screen.findByRole("dialog", { name: "멤버 초대" });
    expect(within(sheet).getByText(/\/join\/NEWcode_02$/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the new link when only the rotation went through", async () => {
    actions.removeTeamMember.mockResolvedValue({
      success: false,
      reason: "invite_rotated_remove_failed",
      inviteCode: "NEWcode_03",
    });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "내보내기" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /초대 링크도 새로 만들기/ }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("링크는 바꿨지만 내보내지 못했어요");
    expect(screen.getByRole("checkbox", { name: /초대 링크도 새로 만들기/ })).not.toBeChecked();
    // No second sheet stacked on the open dialog; the new link waits in the invite sheet.
    expect(screen.queryByRole("dialog", { name: "멤버 초대" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "멤버 초대" }));
    expect(screen.getByText(/\/join\/NEWcode_03$/)).toBeInTheDocument();
  });

  it("gives members no remove menu", () => {
    renderHome(view());
    expect(screen.queryByRole("button", { name: /메뉴$/ })).not.toBeInTheDocument();
  });

  it("swaps the sheet link after 링크 새로 만들기 and keeps /band/{teamId}", async () => {
    actions.regenerateInviteCode.mockResolvedValue({ success: true, inviteCode: "NEWcode_04" });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "멤버 초대" }));
    const sheet = screen.getByRole("dialog", { name: "멤버 초대" });
    expect(within(sheet).getByText(/\/join\/OLDcode_01$/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "링크 새로 만들기" }));

    await waitFor(() => expect(within(sheet).getByText(/\/join\/NEWcode_04$/)).toBeInTheDocument());
    expect(showDanger).toHaveBeenCalledWith(expect.any(String), {
      title: "초대 링크를 새로 만들까요?",
      confirmLabel: "새로 만들기",
    });
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("hides 링크 새로 만들기 from members", () => {
    renderHome(view());
    fireEvent.click(screen.getByRole("button", { name: "멤버 초대" }));
    expect(screen.queryByRole("button", { name: "링크 새로 만들기" })).not.toBeInTheDocument();
    expect(screen.getByText("이 링크를 받은 사람은 누구나 들어올 수 있어요")).toBeInTheDocument();
  });
});
