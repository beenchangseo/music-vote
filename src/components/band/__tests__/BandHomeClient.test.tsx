// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamHomeView, TeamRoom } from "@/actions/team";
import type { MemberKey } from "@/domain/types";
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh: vi.fn() }), usePathname: () => "/band/team" }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showDanger, showAlert: vi.fn(), showConfirm: vi.fn() }) }));

type MemberView = Extract<TeamHomeView, { access: "member" }>;
const TEAM = "11111111-1111-4111-8111-111111111111";
const key = (value: string) => value as MemberKey;

function room(overrides: Partial<TeamRoom> = {}): TeamRoom {
  return {
    id: "room-1",
    shareCode: "abc123",
    title: "10월 정기 합주",
    createdAt: "2026-10-01T03:00:00Z",
    setlistConfirmed: false,
    setlist: [],
    setlistBlockCount: 0,
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
      { memberKey: key("k-vocal"), displayName: "보컬", role: "owner", joinedAt: "2026-09-01T00:00:00Z", isMe: false, canRemove: false },
      { memberKey: key("k-guitar"), displayName: "기타", role: "member", joinedAt: "2026-09-02T00:00:00Z", isMe: true, canRemove: false },
    ],
    rooms: [],
    ...overrides,
  };
}

const ownerView = (overrides: Partial<MemberView> = {}) =>
  view({
    myRole: "owner",
    members: [
      { memberKey: key("k-vocal"), displayName: "보컬", role: "owner", joinedAt: "2026-09-01T00:00:00Z", isMe: true, canRemove: false },
      { memberKey: key("k-guitar"), displayName: "기타", role: "member", joinedAt: "2026-09-02T00:00:00Z", isMe: false, canRemove: true },
    ],
    ...overrides,
  });

const OTHER_TEAM = "33333333-3333-4333-8333-333333333333";
const MY_BANDS = [
  { id: OTHER_TEAM, name: "목요일 잼" },
  { id: TEAM, name: "일코해제" },
];

function renderHome(v: MemberView, flags: { created?: boolean; joined?: boolean } = {}) {
  return render(
    <BandHomeClient view={v} bands={MY_BANDS} account={{ nickname: "기타", avatarUrl: null }} created={!!flags.created} joined={!!flags.joined} />,
  );
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
    expect(await screen.findByRole("alert")).toHaveTextContent("리더는 밴드를 나갈 수 없어요");
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
  });

  it("does not ask once a second member is in", () => {
    renderHome(ownerView());
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
  });

  it("closes the call-members card and keeps it closed for this band in this browser", () => {
    const lone = ownerView({ members: [ownerView().members[0]], rooms: [room()] });
    renderHome(lone);
    // The nearest box around the card's text that also holds its close button.
    let card = screen.getByText("멤버를 불러야 같이 투표해요").parentElement!;
    while (!within(card).queryByRole("button", { name: "안내 닫기" })) card = card.parentElement!;
    fireEvent.click(within(card).getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(`plypick:band-invite-card-dismissed:${TEAM}`)).toBe("1");

    cleanup();
    renderHome(lone);
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
    // The invite icon in the action row still works.
    fireEvent.click(screen.getByRole("button", { name: "멤버 초대" }));
    expect(screen.getByRole("dialog", { name: "멤버 초대" })).toBeInTheDocument();
  });

  // #80 V3: the whole card is one link to the playlist. A stage badge, the title and the counts; no caption, no
  // sentence promising the setlist, no play disc.
  const nowCard = () => within(screen.getByRole("region", { name: "지금 플레이리스트" })).getByRole("link");
  const PLAY_TRIANGLE = "M8 5.14v13.72";

  // The badge, title and counts are one link, so a screen reader reads them as one name; the commas make it pause.
  it("features a running room that is still voting", () => {
    renderHome(view({ rooms: [room({ songCount: 7 })] }));
    const card = nowCard();
    expect(card).toHaveAttribute("href", "/playlist/abc123");
    expect(card).toHaveAccessibleName("투표 중, 10월 정기 합주, 후보곡 7곡");
    expect(card.innerHTML).not.toContain(PLAY_TRIANGLE);
  });

  it("counts a setlist made only of 자작곡 as a setlist being built", () => {
    renderHome(view({ rooms: [room({ setlistBlockCount: 3, songCount: 2 })] }));
    expect(nowCard()).toHaveAccessibleName("셋리스트 짜는 중, 10월 정기 합주, 셋리스트 3곡 · 후보곡 2곡");
  });

  it("leaves out a count of zero instead of printing 후보곡 0곡", () => {
    renderHome(view({ rooms: [room({ setlistBlockCount: 3 })] }));
    expect(nowCard()).toHaveAccessibleName("셋리스트 짜는 중, 10월 정기 합주, 셋리스트 3곡");
    cleanup();
    renderHome(view({ rooms: [room()] }));
    expect(nowCard()).toHaveAccessibleName("투표 중, 10월 정기 합주");
    expect(nowCard().textContent).not.toContain("0곡");
  });

  it("features a running room whose setlist is being built, without promising the setlist tab", () => {
    const setlist = Array.from({ length: 8 }, (_, i) => ({
      songId: `s${i}`,
      title: `곡 ${i}`,
      artist: "밴드",
      position: i,
      videoId: `v${i}`,
      thumbnailUrl: `https://img.youtube.com/vi/v${i}/mqdefault.jpg`,
    }));
    renderHome(view({ rooms: [room({ songCount: 12, setlist, setlistBlockCount: 8 })] }));
    const card = nowCard();
    expect(card).toHaveAttribute("href", "/playlist/abc123");
    expect(card).toHaveAccessibleName("셋리스트 짜는 중, 10월 정기 합주, 셋리스트 8곡 · 후보곡 12곡");
    expect(card.innerHTML).not.toContain(PLAY_TRIANGLE);
  });

  it("has no 지금 card when nothing is running", () => {
    renderHome(view({ rooms: [room({ setlistConfirmed: true, setlistBlockCount: 8 })] }));
    expect(screen.queryByRole("region", { name: "지금 플레이리스트" })).not.toBeInTheDocument();
  });
});

describe("BandHomeClient start area for a new empty band (DR1, DR16)", () => {
  const empty = () => ownerView({ members: [ownerView().members[0]], rooms: [] });

  it("gathers the first steps into one area and hides the other ways in", () => {
    renderHome(empty());
    const area = screen.getByRole("region", { name: "첫 플레이리스트부터 시작해요" });
    // #110: the tab bar's ＋ 만들기 makes the first playlist, so the area has no create button of its own.
    expect(within(area).queryAllByRole("link")).toHaveLength(0);
    expect(within(area).getAllByRole("button").map((button) => button.textContent)).toEqual(["카톡으로 멤버 부르기"]);
    // One way to invite: the start area. No icon, no 더 부르기 tile, no call-members card.
    expect(screen.getAllByRole("button", { name: /부르기|멤버 초대/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "멤버 초대" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 부르기" })).not.toBeInTheDocument();
    expect(screen.queryByText("멤버를 불러야 같이 투표해요")).not.toBeInTheDocument();
    // No lone avatar link above the area; the members section shows the one member.
    expect(screen.queryByRole("link", { name: "멤버 1명" })).not.toBeInTheDocument();
    // No empty shelf and no empty history.
    expect(screen.queryByRole("region", { name: /^플레이리스트/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole("region", { name: /^플레이리스트\s*0$/ })).toHaveTextContent("새 플레이리스트를 만들면 여기에 모여요");
  });

  it("sends an invite card that names the band's leader, not '멤버 1명' (DR13)", () => {
    const sendDefault = vi.fn();
    window.Kakao = { isInitialized: () => true, Share: { sendDefault } };
    try {
      renderHome(empty());
      fireEvent.click(screen.getByRole("button", { name: "카톡으로 멤버 부르기" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "멤버 초대" })).getByRole("button", { name: "카톡으로 보내기" }));
      const card = sendDefault.mock.calls[0][0] as { content: { description: string } };
      expect(card.content.description).toBe("리더 보컬님의 밴드 · 카카오 로그인 한 번이면 합류");
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

describe("BandHomeClient without 있던 플레이리스트 넣기 (#110) and the guests line (DR9)", () => {
  it.each([
    ["an owner's shelf", ownerView({ rooms: [room()] })],
    ["an empty band's start area", ownerView({ members: [ownerView().members[0]], rooms: [] })],
    ["a member's shelf", view({ rooms: [room()] })],
  ])("offers no way to put an existing playlist in from %s", (_label, v) => {
    renderHome(v);
    expect(screen.queryByRole("button", { name: /넣기/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/있던 플레이리스트/)).not.toBeInTheDocument();
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

  it("shelves every room in the order the server sends, newest first, with no 만들기 tile ahead of them (#110)", () => {
    renderHome(
      view({
        rooms: [
          room({ id: "r4", title: "12월 합주", shareCode: "newest", createdAt: "2026-11-05T03:00:00Z" }),
          room({ id: "r3", title: "11월 합주", shareCode: "new", setlistBlockCount: 2, createdAt: "2026-11-02T03:00:00Z" }),
          room({ id: "r2", title: "10월 합주", setlist: [run, crush], setlistBlockCount: 2, setlistConfirmed: true, createdAt: "2026-10-12T03:00:00Z" }),
          // The cron confirms an expired playlist with no songs only to take it off its queue.
          room({ id: "r1", title: "9월 합주", shareCode: "old", setlistConfirmed: true, createdAt: "2026-09-05T03:00:00Z" }),
        ],
      }),
    );
    const shelf = screen.getByRole("region", { name: /^플레이리스트\s*4$/ });
    const links = within(shelf).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/playlist/newest", "/playlist/new", "/playlist/abc123", "/playlist/old"]);
    expect(within(shelf).queryByText("만들기")).not.toBeInTheDocument();
    [
      "12월 합주, 투표 중, 11월 5일",
      "11월 합주, 셋리스트 짜는 중, 11월 2일",
      "10월 합주, 셋리스트 확정, 10월 12일",
      "9월 합주, 마감, 9월 5일",
    ].forEach((name, i) => expect(links[i]).toHaveAccessibleName(name));
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
      memberKey: key(`k-${i}`),
      displayName: `멤버${i}`,
      role: i === 0 ? ("owner" as const) : ("member" as const),
      joinedAt: `2026-09-0${i + 1}T00:00:00Z`,
      isMe: i === 1,
      canRemove: false,
    }));
    renderHome(view({ members }));
    expect(screen.getByRole("link", { name: "멤버 6명" })).toHaveTextContent("+2");
    expect(screen.getByRole("region", { name: /멤버\s*6/ })).toHaveTextContent("리더");
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

    await waitFor(() => expect(actions.removeTeamMember).toHaveBeenCalledWith(TEAM, "k-guitar", false));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("기타")).not.toBeInTheDocument();
  });

  it("offers removal only on the members the server says can be removed", () => {
    renderHome(
      ownerView({
        members: [
          { memberKey: key("k-vocal"), displayName: "보컬", role: "owner", joinedAt: "2026-09-01T00:00:00Z", isMe: true, canRemove: false },
          { memberKey: key("k-guitar"), displayName: "기타", role: "member", joinedAt: "2026-09-02T00:00:00Z", isMe: false, canRemove: false },
        ],
      }),
    );
    expect(screen.queryByRole("button", { name: "기타 메뉴" })).not.toBeInTheDocument();
  });

  it("shows the new invite link after removing with rotation, without moving the band address", async () => {
    actions.removeTeamMember.mockResolvedValue({ success: true, inviteCode: "NEWcode_02" });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "내보내기" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /초대 링크도 새로 만들기/ }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));

    await waitFor(() => expect(actions.removeTeamMember).toHaveBeenCalledWith(TEAM, "k-guitar", true));
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

  it("hands focus back to the member's menu button when Escape closes the menu", () => {
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    const item = screen.getByRole("menuitem", { name: "내보내기" });
    item.focus();
    fireEvent.keyDown(item, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기타 메뉴" })).toHaveFocus();
  });

  it("hands focus back to the member's menu button when the remove dialog is cancelled", () => {
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    const item = screen.getByRole("menuitem", { name: "내보내기" });
    item.focus();
    fireEvent.click(item);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기타 메뉴" })).toHaveFocus();
  });

  it("moves focus to the members title once the removed member's menu button is gone", async () => {
    actions.removeTeamMember.mockResolvedValue({ success: true, inviteCode: null });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    const item = screen.getByRole("menuitem", { name: "내보내기" });
    item.focus();
    fireEvent.click(item);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "내보내기" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "멤버 1" })).toHaveFocus();
  });

  it("returns focus to the members title when the new invite link sheet closes", async () => {
    actions.removeTeamMember.mockResolvedValue({ success: true, inviteCode: "NEWcode_04" });
    renderHome(ownerView());
    fireEvent.click(screen.getByRole("button", { name: "기타 메뉴" }));
    const item = screen.getByRole("menuitem", { name: "내보내기" });
    item.focus();
    fireEvent.click(item);
    fireEvent.click(screen.getByRole("checkbox", { name: /초대 링크도 새로 만들기/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "내보내기" }));

    const sheet = await screen.findByRole("dialog", { name: "멤버 초대" });
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(within(sheet).getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "멤버 1" })).toHaveFocus();
  });

  it("gives members no remove menu", () => {
    renderHome(view());
    expect(within(screen.getByRole("region", { name: /^멤버/ })).queryByRole("button", { name: /메뉴$/ })).not.toBeInTheDocument();
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

describe("BandHomeClient band switcher (#106)", () => {
  it("puts the band name with a caret at the top left instead of a chevron that reads as back", () => {
    renderHome(view());

    expect(screen.getByRole("button", { name: "일코해제 밴드 바꾸기" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("link", { name: "홈으로" })).not.toBeInTheDocument();
  });

  it("lists my bands in a sheet: this one checked, the others to their band home, then 전체 홈", () => {
    renderHome(view());
    fireEvent.click(screen.getByRole("button", { name: "일코해제 밴드 바꾸기" }));
    const sheet = within(screen.getByRole("dialog", { name: "내 밴드" }));

    expect(sheet.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["목요일 잼", `/band/${OTHER_TEAM}`],
      ["전체 홈", "/"],
    ]);
    expect(sheet.getByText("일코해제").closest("[aria-current]")).toHaveAttribute("aria-current", "true");
    expect(sheet.queryByRole("link", { name: "일코해제" })).not.toBeInTheDocument();
  });
});

describe("BandHomeClient top row (#106)", () => {
  // The layout's account button is fixed at the top right, and a long band name in the switcher ran under it. Drawn in
  // the row, the menu takes its own room and the fixed one steps aside (layout.tsx).
  it("draws the account menu in the switcher's row, taking over from the fixed one", () => {
    renderHome(view({}, { name: "토요일 오후 세 시 합정 연습실 밴드" }));

    expect(screen.getByRole("button", { name: "토요일 오후 세 시 합정 연습실 밴드 밴드 바꾸기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기타 계정 메뉴" }).closest("[data-account-in-flow]")).not.toBeNull();
  });
});

describe("BandHomeClient tab bar (#110)", () => {
  const nav = () => screen.getByRole("navigation", { name: "밴드 화면" });
  const tabs = () => [...nav().querySelectorAll("a, button")].map((tab) => tab.textContent);

  it("puts the band-level tabs at the bottom: 밴드 홈 (current) · 플레이리스트 · 만들기 in this band", () => {
    renderHome(view({ rooms: [room()] }));

    expect(tabs()).toEqual(["밴드 홈", "플레이리스트", "만들기"]);
    expect(within(nav()).getByRole("button", { name: "밴드 홈" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "만들기" })).toHaveAttribute("href", `/new?band=${TEAM}`);
  });

  // The 지금 card still features only the newest playlist (1A); the tab looks past a newer confirmed one.
  it("goes straight to the one running playlist, even an older one under a newer confirmed one", () => {
    renderHome(
      view({
        rooms: [
          room({ shareCode: "done001", setlistConfirmed: true, setlistBlockCount: 8 }),
          room({ id: "room-0", shareCode: "vote001" }),
        ],
      }),
    );

    expect(within(nav()).getByRole("link", { name: "플레이리스트" })).toHaveAttribute("href", "/playlist/vote001");
    expect(screen.queryByRole("region", { name: "지금 플레이리스트" })).not.toBeInTheDocument();
  });

  it("opens a picker of the band's playlists when none is running", () => {
    renderHome(
      view({
        rooms: [
          room({ title: "10월 합주", shareCode: "last001", setlistConfirmed: true, setlistBlockCount: 3 }),
          room({ id: "room-0", title: "9월 합주", shareCode: "old0001", setlistConfirmed: true, createdAt: "2026-09-01T03:00:00Z" }),
        ],
      }),
    );

    fireEvent.click(within(nav()).getByRole("button", { name: "플레이리스트" }));
    const picker = screen.getByRole("dialog", { name: "플레이리스트" });
    expect(within(picker).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/playlist/last001", "/playlist/old0001"]);
  });

  it("keeps all three tabs lit for a band with no playlist, the picker pointing to 만들기", () => {
    renderHome(ownerView({ rooms: [] }));

    expect(nav().querySelector("[aria-disabled]")).toBeNull();
    fireEvent.click(within(nav()).getByRole("button", { name: "플레이리스트" }));
    expect(screen.getByRole("dialog", { name: "플레이리스트" })).toHaveTextContent("아래 ＋ 만들기로 첫 플레이리스트를 만들어요");
  });
});
