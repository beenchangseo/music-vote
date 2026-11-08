// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SongWithScore } from "@/domain/types";
import SongMeta from "../SongMeta";

const updateSongMeta = vi.hoisted(() => vi.fn());
vi.mock("@/actions/song", () => ({ updateSongMeta }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

const song = {
  id: "s1",
  title: "예뻤어",
  artist: "DAY6",
  tempo_bpm: 107,
  key_root: "C",
  key_mode: "major",
  key_memo: null,
  duration_seconds: 284,
  difficulty: 3,
  genre: null,
} as unknown as SongWithScore;

afterEach(() => {
  cleanup();
  updateSongMeta.mockReset();
});

describe("SongMeta", () => {
  it("says which key is picked and saves a new pick", () => {
    updateSongMeta.mockResolvedValue({ success: true });
    render(<SongMeta song={song} playlistId="p" shareCode="abc123" onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "C" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "없음" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "★★★" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "D" }));

    expect(screen.getByRole("button", { name: "D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "C" })).toHaveAttribute("aria-pressed", "false");
    expect(updateSongMeta).toHaveBeenCalledWith("s1", "p", "abc123", { keyRoot: "D" });
  });

  it("names each field and saves the BPM and length typed into them", () => {
    updateSongMeta.mockResolvedValue({ success: true });
    render(<SongMeta song={song} playlistId="p" shareCode="abc123" onClose={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "BPM" })).toHaveValue(107);
    expect(screen.getByRole("spinbutton", { name: "길이 분" })).toHaveValue(4);
    expect(screen.getByRole("spinbutton", { name: "길이 초" })).toHaveValue(44);

    fireEvent.change(screen.getByRole("spinbutton", { name: "BPM" }), { target: { value: "120" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "길이 분" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "길이 초" }), { target: { value: "5" } });
    fireEvent.change(screen.getByRole("textbox", { name: "키 메모" }), { target: { value: "capo 2" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "키 메모" }));

    expect(updateSongMeta).toHaveBeenLastCalledWith("s1", "p", "abc123", { keyMemo: "capo 2", tempoBpm: 120, durationSeconds: 185 });
  });

  it("folds through the card and links the metronome at the song's BPM", () => {
    const onClose = vi.fn();
    render(<SongMeta song={song} playlistId="p" shareCode="abc123" onClose={onClose} />);

    expect(screen.getByRole("link", { name: /메트로놈/ })).toHaveAttribute("href", "/playlist/abc123/metronome?bpm=107&songId=s1");
    fireEvent.click(screen.getByRole("button", { name: /접기/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
