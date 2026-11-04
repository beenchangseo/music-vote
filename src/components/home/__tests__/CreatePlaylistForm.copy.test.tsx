// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreatePlaylistForm from "../CreatePlaylistForm";

const createPlaylist = vi.fn();

vi.mock("@/actions/playlist", () => ({ createPlaylist: (...args: unknown[]) => createPlaylist(...args) }));
vi.mock("@/actions/team", () => ({ createBandPlaylist: vi.fn(), attachPlaylistToTeam: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

// findByRole polls on real timers, so the clock is faked only once the completion screen is up.
async function createdScreen() {
  const view = render(<CreatePlaylistForm />);
  fireEvent.change(screen.getByPlaceholderText(/어떤 합주예요/), { target: { value: "11월 합주" } });
  fireEvent.click(screen.getByRole("button", { name: "플레이리스트 만들기" }));
  await screen.findByRole("heading", { name: "11월 합주" });
  vi.useFakeTimers();
  return view;
}

async function copyLink() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "링크 복사" })));
}

beforeEach(() => {
  createPlaylist.mockReset().mockResolvedValue({ id: "room-1", shareCode: "abc123", adminToken: "token" });
  window.localStorage.clear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("CreatePlaylistForm link copy", () => {
  it("says 복사됨 for 2 seconds after copying the room link", async () => {
    await createdScreen();
    await copyLink();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/playlist/abc123"));
    expect(screen.getByRole("button", { name: "복사됨" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByRole("button", { name: "복사됨" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  });

  it("leaves no timer behind when it unmounts while saying 복사됨", async () => {
    const { unmount } = await createdScreen();
    await copyLink();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
