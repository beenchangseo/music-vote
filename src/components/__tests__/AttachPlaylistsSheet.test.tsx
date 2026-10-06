// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttachPlaylistsSheet from "../AttachPlaylistsSheet";

const state = vi.hoisted(() => ({
  getAttachablePlaylists: vi.fn(),
  attachPlaylistToTeam: vi.fn(),
  track: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/actions/team", () => ({
  getAttachablePlaylists: state.getAttachablePlaylists,
  attachPlaylistToTeam: state.attachPlaylistToTeam,
}));
vi.mock("@/lib/analytics", () => ({ track: state.track }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("next/image", () => ({ default: () => null }));

const TEAM = "11111111-1111-4111-8111-111111111111";
const playlist = (id: string, title: string) => ({
  id,
  shareCode: `code-${id}`,
  title,
  createdAt: "2026-10-01T03:00:00Z",
  participantCount: 4,
  coverThumbs: [],
});
const LIST = [playlist("pl-1", "10월 합주"), playlist("pl-2", "9월 합주")];

function open(onClose = vi.fn()) {
  render(<AttachPlaylistsSheet open onClose={onClose} teamId={TEAM} count={2} />);
  return screen.getByRole("dialog", { name: "있던 플레이리스트 넣기 · 2개" });
}

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
  state.getAttachablePlaylists.mockResolvedValue({ success: true, playlists: LIST });
  state.attachPlaylistToTeam.mockResolvedValue({ success: true, teamId: TEAM });
});

afterEach(cleanup);

describe("AttachPlaylistsSheet (DR8, DR9)", () => {
  it("says putting in does not make members, shows a skeleton, then each row with participants and date", async () => {
    const sheet = open();
    expect(within(sheet).getByText("넣어도 참여자는 밴드 멤버가 되지 않아요")).toBeInTheDocument();
    expect(within(sheet).getByRole("list", { name: "플레이리스트를 불러오는 중" })).toBeInTheDocument();
    expect(await within(sheet).findByText("10월 합주")).toBeInTheDocument();
    expect(within(sheet).getAllByText("참여자 4명 · 10월 1일")).toHaveLength(2);
    expect(state.getAttachablePlaylists).toHaveBeenCalledWith(TEAM);
  });

  it("puts one in, keeps the sheet open for the next, and says when all are in", async () => {
    const onClose = vi.fn();
    const sheet = open(onClose);
    fireEvent.click(await within(sheet).findByRole("button", { name: "「10월 합주」 넣기" }));
    expect(await within(sheet).findByText("넣었어요 ✓")).toBeInTheDocument();
    expect(state.attachPlaylistToTeam).toHaveBeenCalledWith("pl-1", TEAM);
    expect(state.track).toHaveBeenCalledWith("team_created", { source: "attach" });
    expect(within(sheet).getByRole("status")).toHaveTextContent("「10월 합주」을 넣었어요");
    expect(within(sheet).queryByText("모두 넣었어요")).not.toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "「9월 합주」 넣기" }));
    expect(await within(sheet).findByText("모두 넣었어요")).toBeInTheDocument();
    // Closing after a change reads the band home again.
    fireEvent.click(within(sheet).getAllByRole("button", { name: "닫기" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a failure under that row only, with a retry", async () => {
    state.attachPlaylistToTeam.mockResolvedValueOnce({ success: false, reason: "already_in_team" });
    const sheet = open();
    fireEvent.click(await within(sheet).findByRole("button", { name: "「10월 합주」 넣기" }));
    expect(await within(sheet).findByText("이미 다른 밴드에 들어 있는 플레이리스트예요")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "「9월 합주」 넣기" })).toBeEnabled();
    fireEvent.click(within(sheet).getByRole("button", { name: "「10월 합주」 다시 넣기" }));
    expect(await within(sheet).findByText("넣었어요 ✓")).toBeInTheDocument();
  });

  it("offers to load again when the list cannot be read", async () => {
    state.getAttachablePlaylists.mockResolvedValueOnce({ success: false, reason: "write_failed" });
    const sheet = open();
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("목록을 불러오지 못했어요");
    fireEvent.click(within(sheet).getByRole("button", { name: "다시 불러오기" }));
    expect(await within(sheet).findByText("10월 합주")).toBeInTheDocument();
    expect(state.getAttachablePlaylists).toHaveBeenCalledTimes(2);
  });

  it("does not reload the band home when nothing was put in", async () => {
    const onClose = vi.fn();
    const sheet = open(onClose);
    await within(sheet).findByText("10월 합주");
    fireEvent.click(within(sheet).getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(state.refresh).not.toHaveBeenCalled();
  });
});
