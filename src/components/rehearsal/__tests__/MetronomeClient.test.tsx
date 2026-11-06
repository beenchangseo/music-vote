// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MetronomeClient from "../MetronomeClient";

const metronome = vi.hoisted(() => ({ isPlaying: false, beat: 0, start: vi.fn(), stop: vi.fn() }));
vi.mock("@/hooks/useMetronome", () => ({ useMetronome: () => metronome }));

afterEach(() => {
  cleanup();
  metronome.isPlaying = false;
  metronome.start.mockReset();
  metronome.stop.mockReset();
});

describe("MetronomeClient", () => {
  it("lists songs by the title the candidates tab shows", () => {
    render(
      <MetronomeClient
        shareCode="abc123"
        playlistTitle="10월 합주"
        songs={[{ id: "pretty", title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]", artist: "DAY6(데이식스)", tempo_bpm: 107 }]}
      />,
    );

    expect(screen.getByRole("option", { name: "예뻤어 (107 BPM)" })).toBeInTheDocument();
    expect(screen.getByText(/^현재:/)).toHaveTextContent("현재: 예뻤어 · 107 BPM");
  });

  it("names the way back to the playlist", () => {
    render(<MetronomeClient shareCode="abc123" playlistTitle="10월 합주" songs={[]} initialBpm={120} />);

    expect(screen.getByRole("link", { name: "플레이리스트로 돌아가기" })).toHaveAttribute("href", "/playlist/abc123");
  });

  it("names each tempo step by what it does and moves the BPM by it", () => {
    render(<MetronomeClient shareCode="abc123" playlistTitle="10월 합주" songs={[]} initialBpm={120} />);

    fireEvent.click(screen.getByRole("button", { name: "BPM 5 내리기" }));
    expect(screen.getByText("115")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BPM 1 내리기" }));
    expect(screen.getByText("114")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BPM 1 올리기" }));
    expect(screen.getByText("115")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BPM 5 올리기" }));
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("starts and stops from one named button", () => {
    const { rerender } = render(<MetronomeClient shareCode="abc123" playlistTitle="10월 합주" songs={[]} initialBpm={120} />);
    fireEvent.click(screen.getByRole("button", { name: "메트로놈 시작" }));
    expect(metronome.start).toHaveBeenCalledTimes(1);

    metronome.isPlaying = true;
    rerender(<MetronomeClient shareCode="abc123" playlistTitle="10월 합주" songs={[]} initialBpm={120} />);
    fireEvent.click(screen.getByRole("button", { name: "메트로놈 정지" }));
    expect(metronome.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "메트로놈 시작" })).not.toBeInTheDocument();
  });
});
