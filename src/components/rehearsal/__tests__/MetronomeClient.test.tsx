// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MetronomeClient from "../MetronomeClient";

vi.mock("@/hooks/useMetronome", () => ({ useMetronome: () => ({ isPlaying: false, beat: 0, start: vi.fn(), stop: vi.fn() }) }));

afterEach(cleanup);

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
});
