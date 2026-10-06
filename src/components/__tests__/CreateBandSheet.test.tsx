// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateBandSheet, { type BandCandidate } from "../CreateBandSheet";

const state = vi.hoisted(() => ({
  createTeam: vi.fn(),
  createTeamFromPlaylist: vi.fn(),
  getVotingSettings: vi.fn(),
  track: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/actions/team", () => ({
  createTeam: state.createTeam,
  createTeamFromPlaylist: state.createTeamFromPlaylist,
}));
vi.mock("@/actions/member", () => ({ getVotingSettings: state.getVotingSettings }));
vi.mock("@/lib/analytics", () => ({ track: state.track }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));

const TEAM = "11111111-1111-4111-8111-111111111111";
const candidate: BandCandidate = { id: "pl-1", title: "10월 정기 합주", memberCount: 5, memberPreview: ["기타", "베이스", "드럼"] };

function openHome(props: { candidates?: BandCandidate[]; participantOnlyTitle?: string | null; source?: "home" | "home_card" } = {}) {
  return render(
    <CreateBandSheet
      open
      onClose={vi.fn()}
      mode="home"
      source={props.source ?? "home"}
      candidates={props.candidates ?? []}
      participantOnlyTitle={props.participantOnlyTitle ?? null}
    />,
  );
}

function submitName(name: string) {
  fireEvent.change(screen.getByLabelText("밴드 이름"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "밴드 만들기" }));
}

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
  state.createTeam.mockResolvedValue({ success: true, teamId: TEAM });
  state.createTeamFromPlaylist.mockResolvedValue({ success: true, teamId: TEAM, name: "일코해제", inviteCode: "c", memberCount: 5 });
  state.getVotingSettings.mockResolvedValue({ members: [] });
});

afterEach(cleanup);

describe("CreateBandSheet from home (DR3, DR11, DR14)", () => {
  it("goes straight to an empty band without candidates, with no 나중에 and a line on what comes next", async () => {
    openHome();
    expect(screen.getByLabelText("밴드 이름")).toHaveFocus();
    expect(screen.getByText("만들고 나면 단톡방에 초대 링크를 보내요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "나중에" })).not.toBeInTheDocument();
    expect(screen.queryByText(/참여자/)).not.toBeInTheDocument();

    submitName("  일코해제 ");
    await waitFor(() => expect(state.push).toHaveBeenCalledWith(`/band/${TEAM}?created=1`));
    expect(state.createTeam).toHaveBeenCalledWith("  일코해제 ");
    expect(state.createTeamFromPlaylist).not.toHaveBeenCalled();
    expect(state.track).toHaveBeenCalledWith("team_created", { source: "home" });
  });

  it("offers the playlists voted with before an empty band, and builds from the one picked", async () => {
    openHome({ candidates: [candidate] });
    expect(screen.queryByLabelText("밴드 이름")).not.toBeInTheDocument();
    expect(screen.getByText("같이 투표한 멤버로 만들기")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /10월 정기 합주\s*멤버 5명/ }));

    expect(screen.getByLabelText("밴드 이름")).toHaveFocus();
    expect(screen.getByText("「10월 정기 합주」 참여자 5명이 멤버가 돼요")).toBeInTheDocument();
    expect(screen.getByText("기타, 베이스, 드럼 외 1명")).toBeInTheDocument();
    submitName("일코해제");

    await waitFor(() => expect(state.push).toHaveBeenCalledWith(`/band/${TEAM}?created=1`));
    expect(state.createTeamFromPlaylist).toHaveBeenCalledWith("pl-1", "일코해제");
    expect(state.createTeam).not.toHaveBeenCalled();
  });

  it("can still start an empty band when candidates exist", async () => {
    openHome({ candidates: [candidate], source: "home_card" });
    fireEvent.click(screen.getByRole("button", { name: "멤버 없이 새 밴드로 시작" }));
    expect(screen.getByLabelText("밴드 이름")).toHaveFocus();
    submitName("일코해제");
    await waitFor(() => expect(state.createTeam).toHaveBeenCalledWith("일코해제"));
    expect(state.track).toHaveBeenCalledWith("team_created", { source: "home_card" });
  });

  it("warns a participant that the room owner can bring everyone in at once (DR11)", () => {
    openHome({ participantOnlyTitle: "보컬님의 합주" });
    expect(
      screen.getByText("「보컬님의 합주」 멤버와 같은 밴드라면, 방장이 그 플레이리스트에서 만들면 다 같이 들어가요"),
    ).toBeInTheDocument();
    // It does not block making a band.
    expect(screen.getByLabelText("밴드 이름")).toBeInTheDocument();
  });

  it("shows the reason under the button and stays on the sheet when it fails", async () => {
    state.createTeam.mockResolvedValue({ success: false, reason: "invalid_name" });
    openHome();
    submitName("일코해제");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.track).not.toHaveBeenCalled();
  });

  it("creates one band for a double tap", async () => {
    let resolve: (value: unknown) => void = () => {};
    state.createTeam.mockReturnValue(new Promise((r) => (resolve = r)));
    openHome();
    fireEvent.change(screen.getByLabelText("밴드 이름"), { target: { value: "일코해제" } });
    const button = screen.getByRole("button", { name: "밴드 만들기" });
    fireEvent.click(button);
    fireEvent.click(button);
    resolve({ success: true, teamId: TEAM });
    await waitFor(() => expect(state.push).toHaveBeenCalled());
    expect(state.createTeam).toHaveBeenCalledTimes(1);
  });
});

describe("CreateBandSheet from a playlist (promote, unchanged)", () => {
  it("keeps the participant preview and 나중에", async () => {
    state.getVotingSettings.mockResolvedValue({ members: [{ display_name: "보컬" }, { display_name: "기타" }] });
    const onCreated = vi.fn();
    render(
      <CreateBandSheet open onClose={vi.fn()} playlistId="pl-1" adminToken={null} source="settings" onCreated={onCreated} />,
    );
    expect(await screen.findByText("이 플레이리스트 참여자 2명이 멤버가 돼요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "나중에" })).toBeInTheDocument();
    submitName("일코해제");
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ teamId: TEAM, name: "일코해제", inviteCode: "c", memberCount: 5 }));
    expect(state.track).toHaveBeenCalledWith("team_created", { source: "settings" });
    expect(state.push).not.toHaveBeenCalled();
  });
});
