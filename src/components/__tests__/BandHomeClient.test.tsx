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
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh: vi.fn() }) }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showDanger, showAlert: vi.fn(), showConfirm: vi.fn() }) }));
// The sheet's own behaviour is in AttachPlaylistsSheet.test; here only who can open it.
vi.mock("../AttachPlaylistsSheet", () => ({
  default: ({ open, count }: { open: boolean; count: number }) =>
    open ? <div role="dialog" aria-label={`있던 플레이리스트 넣기 · ${count}개`} /> : null,
}));

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
    songCount: 0,
    coverThumbs: [],
    participantCount: 0,
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
    attachableCount: null,
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
  window.localStorage.clear();
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
    expect(showDanger).toHaveBeenCalledWith(expect.stringContaining("이미 들어간 플레이리스트는 그대로 남아요"), {
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
    expect(within(banner).getByRole("link", { name: "지금 플레이리스트 가기" })).toHaveAttribute("href", "/playlist/abc123");
  });

  it("does not touch the address without a banner query", () => {
    renderHome(view());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("BandHomeClient primary action (1A)", () => {
  // A lone owner who already has a playlist (made from a room). With none, DR1's start area takes over.
  it("asks a lone owner to call members", () => {
    renderHome(ownerView({ members: [ownerView().members[0]], rooms: [room()] }));
    expect(screen.getByRole("button", { name: "카톡으로 멤버 부르기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 플레이리스트" })).toHaveAttribute("href", `/new?band=${TEAM}`);
  });

  it("does not ask once a second member is in", () => {
    renderHome(ownerView());
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
  });

  it("closes the call-members card and keeps it closed for this band in this browser", () => {
    const lone = ownerView({ members: [ownerView().members[0]], rooms: [room()] });
    renderHome(lone);
    const card = screen.getByText("멤버를 불러야 같이 투표해요").closest("div")!.parentElement!;
    fireEvent.click(within(card).getByRole("button", { name: "닫기" }));
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(`plypick:band-invite-card-dismissed:${TEAM}`)).toBe("1");

    cleanup();
    renderHome(lone);
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
    // The invite icon in the action row still works.
    fireEvent.click(screen.getByRole("button", { name: "멤버 초대" }));
    expect(screen.getByRole("dialog", { name: "멤버 초대" })).toBeInTheDocument();
  });

  it("features the running room", () => {
    renderHome(view({ rooms: [room({ songCount: 7 })] }));
    const card = screen.getByRole("link", { name: /지금 플레이리스트/ });
    expect(card).toHaveAttribute("href", "/playlist/abc123");
    expect(card).toHaveTextContent("투표 중 · 후보곡 7곡");
    expect(screen.getByRole("link", { name: "새 플레이리스트" })).toHaveAttribute("href", `/new?band=${TEAM}`);
  });

  it("falls back to 새 플레이리스트 when nothing is running", () => {
    renderHome(view({ rooms: [room({ setlistConfirmed: true })] }));
    expect(screen.queryByRole("link", { name: /지금 플레이리스트/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 플레이리스트" })).toBeInTheDocument();
  });
});

describe("BandHomeClient start area for a new empty band (DR1, DR16)", () => {
  const empty = () => ownerView({ members: [ownerView().members[0]], rooms: [] });

  it("gathers the first steps into one area and hides the other ways in", () => {
    renderHome(empty());
    const area = screen.getByRole("region", { name: "첫 플레이리스트부터 시작해요" });
    expect(within(area).getByRole("link", { name: "첫 플레이리스트 만들기" })).toHaveAttribute("href", `/new?band=${TEAM}`);
    // One way to invite: the start area. No icon, no 더 부르기 tile, no call-members card.
    expect(screen.getAllByRole("button", { name: /부르기|멤버 초대/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "멤버 초대" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 부르기" })).not.toBeInTheDocument();
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
    // No empty shelf with a second "new playlist" and no empty history.
    expect(screen.queryByRole("link", { name: "새 플레이리스트" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /우리가 했던 곡/ })).not.toBeInTheDocument();

    fireEvent.click(within(area).getByRole("button", { name: "카톡으로 멤버 부르기" }));
    expect(screen.getByRole("dialog", { name: "멤버 초대" })).toBeInTheDocument();
  });

  it("says the band was made in one line, without a member count, and strips the query", () => {
    renderHome(empty(), { created: true });
    expect(screen.getByRole("status")).toHaveTextContent(/^밴드를 만들었어요$/);
    expect(screen.queryByRole("button", { name: "카톡으로 알리기" })).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(`/band/${TEAM}`, { scroll: false });
  });

  it("goes back to the usual home once the band has a playlist", () => {
    renderHome(ownerView({ members: [ownerView().members[0]], rooms: [room()] }));
    expect(screen.queryByRole("region", { name: "첫 플레이리스트부터 시작해요" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "멤버 초대" })).toBeInTheDocument();
  });

  it("goes back to the usual home once a member joins", () => {
    renderHome(ownerView({ rooms: [] }));
    expect(screen.queryByRole("region", { name: "첫 플레이리스트부터 시작해요" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 플레이리스트" })).toBeInTheDocument();
  });

  it("sends an invite card that names who made the band, not '멤버 1명' (DR13)", () => {
    const sendDefault = vi.fn();
    window.Kakao = { isInitialized: () => true, Share: { sendDefault } };
    try {
      renderHome(empty());
      fireEvent.click(screen.getByRole("button", { name: "카톡으로 멤버 부르기" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "멤버 초대" })).getByRole("button", { name: "카톡으로 보내기" }));
      const card = sendDefault.mock.calls[0][0] as { content: { description: string } };
      expect(card.content.description).toBe("보컬님이 밴드를 만들었어요 · 카카오 로그인 한 번이면 합류");
    } finally {
      delete window.Kakao;
    }
  });

  it("tells a member who joined a band with no playlist what to wait for", () => {
    renderHome(view({ rooms: [] }), { joined: true });
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("방장이 첫 플레이리스트를 만들면 여기에 떠요");
    expect(within(banner).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("BandHomeClient attach entry (DR8) and the guests line (DR9)", () => {
  it("gives the owner a 있던 플레이리스트 넣기 tile next to 새 플레이리스트 when there is something to put in", () => {
    renderHome(ownerView({ rooms: [room()], attachableCount: 2 }));
    const shelf = screen.getByRole("region", { name: /^플레이리스트\s*1$/ });
    fireEvent.click(within(shelf).getByRole("button", { name: "있던 플레이리스트 넣기" }));
    expect(screen.getByRole("dialog", { name: "있던 플레이리스트 넣기 · 2개" })).toBeInTheDocument();
  });

  it.each([
    ["nothing to put in", ownerView({ rooms: [room()], attachableCount: 0 })],
    ["the count could not be read", ownerView({ rooms: [room()], attachableCount: null })],
    ["a member", view({ rooms: [room()], attachableCount: null })],
  ])("has no attach tile with %s", (_label, v) => {
    renderHome(v);
    expect(screen.queryByRole("button", { name: "있던 플레이리스트 넣기" })).not.toBeInTheDocument();
  });

  it("opens the sheet from the start area of an empty band", () => {
    renderHome(ownerView({ members: [ownerView().members[0]], rooms: [], attachableCount: 3 }));
    const area = screen.getByRole("region", { name: "첫 플레이리스트부터 시작해요" });
    fireEvent.click(within(area).getByRole("button", { name: "있던 플레이리스트 넣기" }));
    expect(screen.getByRole("dialog", { name: "있던 플레이리스트 넣기 · 3개" })).toBeInTheDocument();
  });

  it("tells a lone owner that the put-in playlist's participants are not members yet", () => {
    renderHome(ownerView({ members: [ownerView().members[0]], rooms: [room({ title: "10월 합주", participantCount: 4 })] }));
    expect(screen.getByText("「10월 합주」 참여자 4명은 아직 밴드 멤버가 아니에요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카톡으로 멤버 부르기" })).toBeInTheDocument();
  });
});

describe("BandHomeClient rooms shelf and played songs (26A, E1)", () => {
  const song = (songId: string, title: string, artist: string, videoId: string, position = 0) => ({
    songId,
    title,
    artist,
    position,
    videoId,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  });
  const run = song("s1", "말달리자", "크라잉넛", "v-run");
  const crush = song("s2", "넌 내게 반했어", "노브레인", "v-crush", 1);

  it("shelves a 새 플레이리스트 tile, then every room newest first", () => {
    renderHome(
      view({
        rooms: [
          room({ id: "r2", title: "10월 합주", setlist: [run, crush] }),
          room({ id: "r1", title: "9월 합주", shareCode: "old", setlist: [{ ...run, songId: "s1-old" }], setlistConfirmed: true }),
        ],
      }),
    );
    const shelf = screen.getByRole("region", { name: /^플레이리스트\s*2$/ });
    expect(within(shelf).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      `/new?band=${TEAM}`,
      "/playlist/abc123",
      "/playlist/old",
    ]);
    expect(within(shelf).getByText(/셋리스트 1곡/)).toBeInTheDocument();
  });

  it("counts a song once per room, puts the most played first and links its latest room", () => {
    renderHome(
      view({
        rooms: [
          room({ id: "r2", title: "10월 합주", setlist: [crush, run] }),
          // Another room's row for the same video: one song, played twice.
          room({ id: "r1", title: "9월 합주", shareCode: "old", setlist: [{ ...run, songId: "s1-old" }], setlistConfirmed: true }),
        ],
      }),
    );
    expect(screen.getByText(/했던 곡 2곡/)).toBeInTheDocument();
    const played = screen.getByRole("region", { name: /우리가 했던 곡\s*2/ });
    const rows = within(played).getAllByRole("link");
    expect(rows[0]).toHaveTextContent("말달리자");
    expect(rows[0]).toHaveTextContent("2번");
    expect(rows[0]).toHaveAttribute("href", "/playlist/abc123");
    expect(rows[1]).toHaveTextContent("넌 내게 반했어");
    expect(rows[1]).not.toHaveTextContent("번");
  });

  it("tells members where the history will appear", () => {
    renderHome(view({ rooms: [room()] }));
    expect(screen.getByText("셋리스트를 짜면 여기에 쌓여요")).toBeInTheDocument();
  });

  it("shows five songs and a 더 보기 for the rest", () => {
    const setlist = Array.from({ length: 7 }, (_, i) => song(`s${i}`, `곡 ${i}`, "밴드", `v${i}`, i));
    renderHome(view({ rooms: [room({ setlist })] }));
    expect(screen.queryByText("곡 6")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "더 보기 (2곡)" }));
    expect(screen.getByText("곡 6")).toBeInTheDocument();
  });
});

describe("BandHomeClient members", () => {
  it("stacks four avatars in the action row and counts the rest", () => {
    const members = Array.from({ length: 6 }, (_, i) => ({
      userId: null,
      displayName: `멤버${i}`,
      role: i === 0 ? ("owner" as const) : ("member" as const),
      joinedAt: `2026-09-0${i + 1}T00:00:00Z`,
      isMe: i === 1,
    }));
    renderHome(view({ members }));
    expect(screen.getByRole("link", { name: "멤버 6명" })).toHaveTextContent("+2");
    expect(screen.getByRole("region", { name: /멤버\s*6/ })).toHaveTextContent("만든 사람");
  });

  it("opens the invite sheet from the 더 부르기 tile", () => {
    renderHome(view());
    fireEvent.click(screen.getByRole("button", { name: "더 부르기" }));
    expect(screen.getByRole("dialog", { name: "멤버 초대" })).toBeInTheDocument();
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
