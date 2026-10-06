// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreatePlaylistForm from "../CreatePlaylistForm";

const createPlaylist = vi.fn();
const createBandPlaylist = vi.fn();
const attachPlaylistToTeam = vi.fn();
const track = vi.fn();
const showAlert = vi.fn();

vi.mock("@/actions/playlist", () => ({ createPlaylist: (...args: unknown[]) => createPlaylist(...args) }));
vi.mock("@/actions/team", () => ({
  createBandPlaylist: (...args: unknown[]) => createBandPlaylist(...args),
  attachPlaylistToTeam: (...args: unknown[]) => attachPlaylistToTeam(...args),
}));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showAlert }) }));

const TEAM = "11111111-1111-4111-8111-111111111111";
const BAND = { id: TEAM, name: "일코해제", nextShowAt: "2026-10-16" };
const room = { id: "room-1", shareCode: "abc123", adminToken: "token" };
const myTeam = (id: string, name: string) => ({ id, name, nextShowAt: null, role: "member" as const, roomCount: 2 });

function submit(title = "11월 합주") {
  fireEvent.change(screen.getByPlaceholderText(/어떤 합주예요/), { target: { value: title } });
  fireEvent.click(screen.getByRole("button", { name: "플레이리스트 만들기" }));
}

beforeEach(() => {
  for (const fn of [createPlaylist, createBandPlaylist, attachPlaylistToTeam, track, showAlert]) fn.mockReset();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("CreatePlaylistForm in a band (/new?band=)", () => {
  it("creates the room inside the band", async () => {
    createBandPlaylist.mockResolvedValue({ success: true, ...room });
    render(<CreatePlaylistForm band={BAND} />);
    submit();
    expect(await screen.findByRole("heading", { name: "11월 합주" })).toBeInTheDocument();
    expect(createBandPlaylist).toHaveBeenCalledWith(TEAM, "11월 합주", undefined, undefined, "free", 3);
    expect(createPlaylist).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("team_playlist_created", { has_next_show: true });
    // A room made from the band does not ask to be put into a band.
    expect(screen.queryByText("이 플레이리스트를 밴드에 넣을까요?")).not.toBeInTheDocument();
  });

  it("shows the returned reason under the button instead of a generic alert", async () => {
    createBandPlaylist.mockResolvedValue({ success: false, reason: "not_member" });
    render(<CreatePlaylistForm band={BAND} />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("밴드 멤버만 할 수 있어요");
    expect(showAlert).not.toHaveBeenCalled();
  });
});

describe("CreatePlaylistForm with exactly one band (DR12, eng E3)", () => {
  it("makes it in that band by default", async () => {
    createBandPlaylist.mockResolvedValue({ success: true, ...room });
    render(<CreatePlaylistForm myTeams={[myTeam(TEAM, "일코해제")]} />);
    expect(screen.getByRole("switch", { name: "일코해제에 만들기" })).toBeChecked();
    submit();
    expect(await screen.findByRole("heading", { name: "11월 합주" })).toBeInTheDocument();
    expect(createBandPlaylist).toHaveBeenCalledWith(TEAM, "11월 합주", undefined, undefined, "free", 3);
    expect(createPlaylist).not.toHaveBeenCalled();
    expect(screen.queryByText("이 플레이리스트를 밴드에 넣을까요?")).not.toBeInTheDocument();
  });

  it("makes it outside when switched off, and does not ask again on the completion screen", async () => {
    createPlaylist.mockResolvedValue(room);
    render(<CreatePlaylistForm myTeams={[myTeam(TEAM, "일코해제")]} />);
    const toggle = screen.getByRole("switch", { name: "일코해제에 만들기" });
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    submit();
    expect(await screen.findByRole("heading", { name: "11월 합주" })).toBeInTheDocument();
    expect(createPlaylist).toHaveBeenCalled();
    expect(createBandPlaylist).not.toHaveBeenCalled();
    expect(screen.queryByText("이 플레이리스트를 밴드에 넣을까요?")).not.toBeInTheDocument();
  });

  it("has no toggle when the page already names the band (?band=)", () => {
    render(<CreatePlaylistForm band={BAND} myTeams={[myTeam(TEAM, "일코해제")]} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});

describe("CreatePlaylistForm completion screen (13A)", () => {
  it("offers my bands for a room made without ?band= when I am in two or more", async () => {
    const other = "22222222-2222-4222-8222-222222222222";
    createPlaylist.mockResolvedValue(room);
    attachPlaylistToTeam.mockResolvedValue({ success: true, teamId: TEAM });
    render(<CreatePlaylistForm myTeams={[myTeam(TEAM, "일코해제"), myTeam(other, "산울림")]} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    submit();
    expect(await screen.findByText("이 플레이리스트를 밴드에 넣을까요?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "일코해제에 넣기" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("밴드에 넣었어요"));
    expect(attachPlaylistToTeam).toHaveBeenCalledWith("room-1", TEAM);
    expect(track).toHaveBeenCalledWith("team_created", { source: "attach" });
  });

  it("lists every band when I am in several and shows a failure under them", async () => {
    const other = "22222222-2222-4222-8222-222222222222";
    createPlaylist.mockResolvedValue(room);
    attachPlaylistToTeam.mockResolvedValue({ success: false, reason: "already_in_team" });
    render(<CreatePlaylistForm myTeams={[myTeam(TEAM, "일코해제"), myTeam(other, "산울림")]} />);
    submit();
    fireEvent.click(await screen.findByRole("button", { name: "산울림에 넣기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 다른 밴드에 들어 있는 플레이리스트예요");
    expect(screen.getByRole("button", { name: "일코해제에 넣기" })).toBeInTheDocument();
  });

  it("says nothing about bands when I have none", async () => {
    createPlaylist.mockResolvedValue(room);
    render(<CreatePlaylistForm />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    submit();
    await screen.findByRole("heading", { name: "11월 합주" });
    expect(screen.queryByText("이 플레이리스트를 밴드에 넣을까요?")).not.toBeInTheDocument();
  });
});
