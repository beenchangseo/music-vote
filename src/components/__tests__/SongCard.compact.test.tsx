// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import SongCard from "../SongCard";
import type { SongWithScore } from "@/lib/types";

vi.mock("@/actions/song", () => ({ removeSong: vi.fn() }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showDanger: vi.fn(), showAlert: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../VoteButtons", () => ({ default: () => <span data-testid="vote" /> }));
vi.mock("../CommentModal", () => ({ default: () => <div role="dialog" aria-label="댓글 창" /> }));
vi.mock("../SongVersionModal", () => ({ default: () => <div role="dialog" aria-label="다른 버전 창" /> }));

const song = {
  id: "song-1",
  playlist_id: "playlist",
  title: "DAY6(데이식스)- 예뻤어 [가사/Lyrics]",
  artist: "웅키",
  youtube_url: "https://youtu.be/abcdefghijk",
  youtube_video_id: "abcdefghijk",
  thumbnail_url: null,
  added_by: "지민",
  added_by_user_id: "adder",
  key_memo: null,
  key_root: null,
  key_mode: null,
  tempo_bpm: null,
  duration_seconds: null,
  difficulty: null,
  genre: null,
  created_at: "2026-01-01T00:00:00Z",
  score: 3,
  votes: [],
  userVote: null,
  userVoteCount: 0,
  commentCount: 2,
  versionCount: 1,
} satisfies SongWithScore;

type Props = Partial<ComponentProps<typeof SongCard>>;

function renderRow(props: Props = {}) {
  return render(
    <SongCard
      song={song}
      votingMode="free"
      nickname="멤버"
      shareCode="share"
      playlistId="playlist"
      isAdmin={false}
      adminToken={null}
      currentUserId="other"
      viewMode="compact"
      rank={1}
      onVotePress={() => undefined}
      isPlaying={false}
      isCurrent={false}
      onTogglePlay={() => undefined}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe("SongCard compact row (디자인 C9)", () => {
  it("shows the cleaned title, the rank and a one-line summary, with the actions folded", () => {
    renderRow({ inSetlist: true });
    expect(screen.getByText("예뻤어")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("DAY6(데이식스)")).toBeInTheDocument();
    expect(screen.getByText("셋리스트에 있음")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle).toHaveAttribute("aria-controls", "song-actions-song-1");
    expect(screen.queryByRole("button", { name: /^댓글/ })).not.toBeInTheDocument();
  });

  it("asks the list to open the row when the title is tapped", () => {
    const onToggleExpand = vi.fn();
    renderRow({ onToggleExpand });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("opens comments and versions from the open row and keeps the original title there", () => {
    renderRow({ expanded: true });
    expect(screen.getByText("원래 제목 · DAY6(데이식스)- 예뻤어 [가사/Lyrics]")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "댓글 2" }));
    expect(screen.getByRole("dialog", { name: "댓글 창" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다른 버전 1" }));
    expect(screen.getByRole("dialog", { name: "다른 버전 창" })).toBeInTheDocument();
  });

  it("adds to the setlist, or takes it out when it is already in", () => {
    const onAddToSetlist = vi.fn();
    const onRemoveFromSetlist = vi.fn();
    const { rerender } = renderRow({ expanded: true, onAddToSetlist, onRemoveFromSetlist });
    fireEvent.click(screen.getByRole("button", { name: "셋리스트에 넣기" }));
    expect(onAddToSetlist).toHaveBeenCalledWith("song-1");

    rerender(
      <SongCard
        song={song}
        votingMode="free"
        nickname="멤버"
        shareCode="share"
        playlistId="playlist"
        isAdmin={false}
        adminToken={null}
        currentUserId="other"
        viewMode="compact"
        rank={1}
        onVotePress={() => undefined}
        isPlaying={false}
        isCurrent={false}
        onTogglePlay={() => undefined}
        expanded
        inSetlist
        onAddToSetlist={onAddToSetlist}
        onRemoveFromSetlist={onRemoveFromSetlist}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "셋리스트에서 빼기" }));
    expect(onRemoveFromSetlist).toHaveBeenCalledWith("song-1");
  });

  it("has no setlist button for someone who cannot edit the setlist", () => {
    renderRow({ expanded: true });
    expect(screen.queryByRole("button", { name: /셋리스트/ })).not.toBeInTheDocument();
  });
});
