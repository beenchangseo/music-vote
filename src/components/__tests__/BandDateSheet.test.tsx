// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BandDateSheet from "../BandDateSheet";

const updateTeamNextShow = vi.fn();
const track = vi.fn();
vi.mock("@/actions/team", () => ({ updateTeamNextShow: (...args: unknown[]) => updateTeamNextShow(...args) }));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

const TEAM = "11111111-1111-4111-8111-111111111111";

function renderSheet(nextShowAt: string | null = null) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<BandDateSheet open onClose={onClose} teamId={TEAM} nextShowAt={nextShowAt} onSaved={onSaved} />);
  return { onSaved, onClose, input: screen.getByLabelText("공연 날짜") };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 2026-10-04 00:30 KST — still 2026-10-03 in UTC.
  vi.setSystemTime(new Date("2026-10-03T15:30:00Z"));
  updateTeamNextShow.mockReset().mockImplementation(async (_team: string, value: string | null) => ({
    success: true,
    nextShowAt: value,
  }));
  track.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BandDateSheet (22A)", () => {
  it("uses today in KST as the earliest date, not the UTC date", () => {
    const { input } = renderSheet();
    expect(input).toHaveAttribute("min", "2026-10-04");
    expect(input).toHaveAttribute("type", "date");
  });

  it("sends nothing while the calendar is being flipped, then saves once", async () => {
    const { input, onSaved, onClose } = renderSheet();
    fireEvent.change(input, { target: { value: "2026-10-10" } });
    fireEvent.change(input, { target: { value: "2026-11-02" } });
    fireEvent.change(input, { target: { value: "2026-10-16" } });
    expect(updateTeamNextShow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("2026-10-16"));
    expect(updateTeamNextShow).toHaveBeenCalledTimes(1);
    expect(updateTeamNextShow).toHaveBeenCalledWith(TEAM, "2026-10-16");
    expect(track).toHaveBeenCalledWith("team_next_show_set", { cleared: false });
    expect(onClose).toHaveBeenCalled();
  });

  it("can clear an existing date", async () => {
    const { onSaved } = renderSheet("2026-10-16");
    fireEvent.click(screen.getByRole("button", { name: "날짜 지우기" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null));
    expect(updateTeamNextShow).toHaveBeenCalledWith(TEAM, null);
    expect(track).toHaveBeenCalledWith("team_next_show_set", { cleared: true });
  });

  it("offers no clear button without a date and keeps 저장 off until a date is picked", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: "날짜 지우기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("shows the server reason under the input", async () => {
    updateTeamNextShow.mockResolvedValue({ success: false, reason: "past_date" });
    const { input, onSaved } = renderSheet();
    fireEvent.change(input, { target: { value: "2026-10-05" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("지난 날짜는 고를 수 없어요");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
