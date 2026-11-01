// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
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
