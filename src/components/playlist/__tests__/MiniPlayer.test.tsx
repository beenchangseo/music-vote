// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import { usePlayerQueue, type QueueSource } from "@/hooks/usePlayerQueue";
import MiniPlayer from "../MiniPlayer";
import type { YouTubePlayerHandle } from "../YouTubePlayer";

const songs = [
  { id: "a", title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]", artist: "STONE MUSIC", thumbnail_url: null },
  { id: "b", title: "[MV] 잔나비 - 주저하는 연인들을 위해", artist: "JANNABI", thumbnail_url: null },
] as SongWithScore[];

const setlist = [
  { id: "item-a", position: 0, item_type: "song", song_id: "a", title_override: "공연용 예뻤어" },
  { id: "item-b", position: 1, item_type: "song", song_id: "b", title_override: "주저하는 연인들을 위해 (어쿠스틱)" },
] as SetlistItem[];

function Player({ source }: { source: QueueSource }) {
  const { state, actions } = usePlayerQueue(songs, setlist);
  return (
    <>
      <button type="button" onClick={() => actions.playSong("a", source)}>
        첫 곡 틀기
      </button>
      <MiniPlayer state={state} actions={actions} playerRef={createRef<YouTubePlayerHandle>()} />
    </>
  );
}

afterEach(cleanup);

describe("MiniPlayer titles", () => {
  it.each([
    ["setlist", "공연용 예뻤어", "주저하는 연인들을 위해 (어쿠스틱)"],
    ["candidates", "예뻤어", "주저하는 연인들을 위해"],
  ] as const)("playing from the %s shows the titles that screen shows", (source, title, next) => {
    render(<Player source={source} />);
    fireEvent.click(screen.getByRole("button", { name: "첫 곡 틀기" }));

    fireEvent.click(screen.getByRole("button", { name: `${title} 플레이어 열기` }));
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "다음 곡" })).getByText(next)).toBeInTheDocument();
    expect(screen.queryByText(/Lyrics|\[MV\]/)).not.toBeInTheDocument();
  });
});

function Controls({ handle }: { handle: YouTubePlayerHandle }) {
  const { state, actions } = usePlayerQueue(songs, setlist);
  return (
    <>
      <button type="button" onClick={() => actions.playSong("a", "candidates")}>
        첫 곡 틀기
      </button>
      <button type="button" onClick={() => actions.setIsPlaying(false)}>
        영상이 멈춤
      </button>
      <MiniPlayer state={state} actions={actions} playerRef={{ current: handle }} />
    </>
  );
}

function fakePlayer(): YouTubePlayerHandle {
  return { play: vi.fn(), pause: vi.fn(), loadVideoById: vi.fn(), getCurrentTime: () => 0, getDuration: () => 0, seekTo: vi.fn() };
}

describe("MiniPlayer controls", () => {
  it("plays and pauses from the bar and from the open player, named by what a press will do", () => {
    const handle = fakePlayer();
    render(<Controls handle={handle} />);
    fireEvent.click(screen.getByRole("button", { name: "첫 곡 틀기" }));

    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(handle.pause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "영상이 멈춤" }));
    fireEvent.click(screen.getByRole("button", { name: "재생" }));
    expect(handle.play).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "예뻤어 플레이어 열기" }));
    const player = screen.getByRole("dialog", { name: "재생 중인 곡" });
    fireEvent.click(within(player).getByRole("button", { name: "재생" }));
    expect(handle.play).toHaveBeenCalledTimes(2);
  });

  it("says whether shuffle and one-song repeat are on", () => {
    render(<Controls handle={fakePlayer()} />);
    fireEvent.click(screen.getByRole("button", { name: "첫 곡 틀기" }));
    fireEvent.click(screen.getByRole("button", { name: "예뻤어 플레이어 열기" }));

    expect(screen.getByRole("button", { name: "셔플 켜기" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "셔플 켜기" }));
    expect(screen.getByRole("button", { name: "셔플 끄기" })).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByRole("button", { name: "한곡 반복" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "한곡 반복" }));
    expect(screen.getByRole("button", { name: "반복 끄기" })).toHaveAttribute("aria-pressed", "true");
  });
});
