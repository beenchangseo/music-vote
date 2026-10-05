// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoomSettingsButton from "../RoomSettingsButton";

const updateSetlistEditMode = vi.fn();
const showAlert = vi.fn();
const push = vi.fn();
const attachPlaylistToTeam = vi.fn();
const createTeamFromPlaylist = vi.fn();
const track = vi.fn();

vi.mock("@/actions/playlist", () => ({
  updateSetlistEditMode: (...args: unknown[]) => updateSetlistEditMode(...args),
  resetPlaylistVotes: vi.fn(),
  deletePlaylist: vi.fn(),
}));
vi.mock("@/actions/member", () => ({
  getVotingSettings: vi.fn().mockResolvedValue({
    mode: "free",
    votesAnonymous: true,
    defaultVoteLimit: 3,
    members: [
      { user_id: "u1", display_name: "보컬", vote_limit: 3, used_votes: 0 },
      { user_id: "u2", display_name: "기타", vote_limit: 3, used_votes: 0 },
    ],
    totalVotes: 0,
  }),
  saveVotingSettings: vi.fn(),
}));
vi.mock("@/actions/team", () => ({
  attachPlaylistToTeam: (...args: unknown[]) => attachPlaylistToTeam(...args),
  createTeamFromPlaylist: (...args: unknown[]) => createTeamFromPlaylist(...args),
}));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
vi.mock("../DialogProvider", () => ({
  useDialog: () => ({ showAlert, showConfirm: vi.fn(), showDanger: vi.fn() }),
}));

const TEAM = "11111111-1111-4111-8111-111111111111";
type SheetProps = Partial<Parameters<typeof RoomSettingsButton>[0]>;

function renderSheet(onChange = vi.fn(), props: SheetProps = {}) {
  render(
    <RoomSettingsButton
      playlistId="playlist"
      shareCode="share"
      adminToken={null}
      supportsVoteAllocation
      setlistEditMode="everyone"
      onSetlistEditModeChange={onChange}
      {...props}
    />,
  );
  return onChange;
}

async function openSettings(props: SheetProps = {}) {
  renderSheet(vi.fn(), props);
  fireEvent.click(screen.getByLabelText("플레이리스트 설정"));
  await screen.findByText("투표 · 공개 범위");
}

function myTeam(id: string, name: string) {
  return { id, name, nextShowAt: null, role: "member" as const, roomCount: 1 };
}

describe("RoomSettingsButton", () => {
  beforeEach(() => {
    updateSetlistEditMode.mockReset().mockResolvedValue(undefined);
    showAlert.mockReset();
    push.mockReset();
    attachPlaylistToTeam.mockReset();
    createTeamFromPlaylist.mockReset();
    track.mockReset();
  });
  afterEach(cleanup);

  it("keeps one settings entry that carries both voting and setlist sections", async () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText("플레이리스트 설정"));

    expect(await screen.findByText("투표 · 공개 범위")).toBeInTheDocument();
    expect(screen.getByText("셋리스트 · 편집 권한")).toBeInTheDocument();
    expect(screen.getByText("플레이리스트 삭제", { selector: "p" })).toBeInTheDocument();
  });

  it("applies the setlist permission optimistically", async () => {
    const onChange = renderSheet();
    fireEvent.click(screen.getByLabelText("플레이리스트 설정"));
    fireEvent.click(await screen.findByRole("button", { name: "방장만 편집" }));

    expect(onChange).toHaveBeenCalledWith("host_only");
    await waitFor(() =>
      expect(updateSetlistEditMode).toHaveBeenCalledWith("playlist", null, "host_only", "share"),
    );
  });

  it("rolls the permission back when the server rejects it", async () => {
    updateSetlistEditMode.mockRejectedValue(new Error("권한 없음"));
    const onChange = renderSheet();
    fireEvent.click(screen.getByLabelText("플레이리스트 설정"));
    fireEvent.click(await screen.findByRole("button", { name: "방장만 편집" }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("everyone"));
    expect(showAlert).toHaveBeenCalledWith("권한 없음");
  });
});

describe("RoomSettingsButton band rows", () => {
  beforeEach(() => {
    push.mockReset();
    attachPlaylistToTeam.mockReset();
    createTeamFromPlaylist.mockReset();
    track.mockReset();
  });
  afterEach(cleanup);

  it("links a band member to the band home", async () => {
    await openSettings({ team: { id: TEAM, name: "일코해제", nextShowAt: null, isMember: true } });
    expect(screen.getByRole("link", { name: /일코해제/ })).toHaveAttribute("href", `/band/${TEAM}`);
    expect(screen.queryByRole("button", { name: "이 멤버로 밴드 만들기" })).not.toBeInTheDocument();
  });

  it("shows only the band name to an owner who is no longer in the band", async () => {
    await openSettings({ team: { id: null, name: "일코해제", nextShowAt: null, isMember: false } });
    expect(screen.getByText("일코해제의 플레이리스트예요")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /일코해제/ })).not.toBeInTheDocument();
  });

  it("offers 'create a band' in a room without one, and no attach row without bands", async () => {
    await openSettings();
    expect(screen.getByRole("button", { name: "이 멤버로 밴드 만들기" })).toBeInTheDocument();
    expect(screen.queryByText("이 플레이리스트를 내 밴드에 넣기")).not.toBeInTheDocument();
  });

  it("creates the band from settings and lands on its home with the banner", async () => {
    createTeamFromPlaylist.mockResolvedValue({
      success: true,
      teamId: TEAM,
      name: "일코해제",
      inviteCode: "aB3_x-9Zq0",
      memberCount: 2,
    });
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "이 멤버로 밴드 만들기" }));

    const sheet = screen.getByRole("dialog", { name: "밴드 만들기" });
    const input = screen.getByLabelText("밴드 이름");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "밴드 만들기" })).toBeDisabled();
    expect(await screen.findByText("이 플레이리스트 참여자 2명이 멤버가 돼요")).toBeInTheDocument();
    expect(sheet).toHaveTextContent("보컬, 기타");

    fireEvent.change(input, { target: { value: "일코해제" } });
    fireEvent.click(screen.getByRole("button", { name: "밴드 만들기" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/band/${TEAM}?created=1`));
    expect(createTeamFromPlaylist).toHaveBeenCalledWith("playlist", "일코해제");
    expect(track).toHaveBeenCalledWith("team_created", { source: "settings" });
  });

  it("shows the server reason under the button when the band cannot be made", async () => {
    createTeamFromPlaylist.mockResolvedValue({ success: false, reason: "already_in_team" });
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "이 멤버로 밴드 만들기" }));
    fireEvent.change(screen.getByLabelText("밴드 이름"), { target: { value: "일코해제" } });
    fireEvent.click(screen.getByRole("button", { name: "밴드 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 다른 밴드에 들어 있는 플레이리스트예요");
    expect(push).not.toHaveBeenCalled();
  });

  it("adds the room to my only band", async () => {
    attachPlaylistToTeam.mockResolvedValue({ success: true, teamId: TEAM });
    await openSettings({ myTeams: [myTeam(TEAM, "일코해제")] });
    fireEvent.click(screen.getByRole("button", { name: "일코해제에 넣기" }));
    expect(await screen.findByRole("status")).toHaveTextContent("밴드에 넣었어요");
    expect(attachPlaylistToTeam).toHaveBeenCalledWith("playlist", TEAM);
    expect(track).toHaveBeenCalledWith("team_created", { source: "attach" });
  });

  it("lets me choose when I am in several bands", async () => {
    const other = "22222222-2222-4222-8222-222222222222";
    attachPlaylistToTeam.mockResolvedValue({ success: false, reason: "not_member" });
    await openSettings({ myTeams: [myTeam(TEAM, "일코해제"), myTeam(other, "산울림")] });
    expect(screen.getByRole("button", { name: "일코해제에 넣기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "산울림에 넣기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("밴드 멤버만 할 수 있어요");
    expect(attachPlaylistToTeam).toHaveBeenCalledWith("playlist", other);
  });
});
