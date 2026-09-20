// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoomSettingsButton from "../RoomSettingsButton";

const updateSetlistEditMode = vi.fn();
const showAlert = vi.fn();

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
    members: [],
    totalVotes: 0,
  }),
  saveVotingSettings: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("../DialogProvider", () => ({
  useDialog: () => ({ showAlert, showConfirm: vi.fn(), showDanger: vi.fn() }),
}));

function renderSheet(onChange = vi.fn()) {
  render(
    <RoomSettingsButton
      playlistId="playlist"
      shareCode="share"
      adminToken={null}
      supportsVoteAllocation
      setlistEditMode="everyone"
      onSetlistEditModeChange={onChange}
    />,
  );
  return onChange;
}

describe("RoomSettingsButton", () => {
  beforeEach(() => {
    updateSetlistEditMode.mockReset().mockResolvedValue(undefined);
    showAlert.mockReset();
  });
  afterEach(cleanup);

  it("keeps one settings entry that carries both voting and setlist sections", async () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText("방 설정"));

    expect(await screen.findByText("투표 · 공개 범위")).toBeInTheDocument();
    expect(screen.getByText("셋리스트 · 편집 권한")).toBeInTheDocument();
    expect(screen.getByText("합주방 삭제", { selector: "p" })).toBeInTheDocument();
  });

  it("applies the setlist permission optimistically", async () => {
    const onChange = renderSheet();
    fireEvent.click(screen.getByLabelText("방 설정"));
    fireEvent.click(await screen.findByRole("button", { name: "방장만 편집" }));

    expect(onChange).toHaveBeenCalledWith("host_only");
    await waitFor(() =>
      expect(updateSetlistEditMode).toHaveBeenCalledWith("playlist", null, "host_only", "share"),
    );
  });

  it("rolls the permission back when the server rejects it", async () => {
    updateSetlistEditMode.mockRejectedValue(new Error("권한 없음"));
    const onChange = renderSheet();
    fireEvent.click(screen.getByLabelText("방 설정"));
    fireEvent.click(await screen.findByRole("button", { name: "방장만 편집" }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("everyone"));
    expect(showAlert).toHaveBeenCalledWith("권한 없음");
  });
});
