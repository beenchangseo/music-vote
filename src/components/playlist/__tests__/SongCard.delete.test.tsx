// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongCard from "../SongCard";
import type { SongWithScore } from "@/domain/types";

const removeSong = vi.fn();
vi.mock("@/actions/song", () => ({ removeSong: (...args: unknown[]) => removeSong(...args) }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showDanger: vi.fn().mockResolvedValue(true), showAlert: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));
vi.mock("../VoteButtons", () => ({ default: () => null }));
vi.mock("../CommentModal", () => ({ default: () => null }));
vi.mock("../SongVersionModal", () => ({ default: () => null }));

const song = {
  id: "song",
  playlist_id: "playlist",
  title: "테스트 곡",
  artist: null,
  youtube_url: "https://youtu.be/abcdefghijk",
  youtube_video_id: "abcdefghijk",
  thumbnail_url: null,
  added_by: "멤버",
  key_memo: null,
  key_root: null,
  key_mode: null,
  tempo_bpm: null,
  duration_seconds: null,
  difficulty: null,
  genre: null,
  created_at: "2026-01-01T00:00:00Z",
  score: 0,
  votes: [],
  userVote: null,
  userVoteCount: 0,
  commentCount: 0,
  versionCount: 0,
  canDelete: false,
} satisfies SongWithScore;

function renderCard(canDelete: boolean) {
  return render(
    <SongCard song={{ ...song, canDelete }} votingMode="free" nickname="멤버" shareCode="share" playlistId="playlist" viewMode="card" onVotePress={() => undefined} isPlaying={false} isCurrent={false} onTogglePlay={() => undefined} />,
  );
}

describe("SongCard deletion permission", () => {
  beforeEach(() => removeSong.mockReset().mockResolvedValue({ success: true }));
  afterEach(cleanup);

  // The page decides who may delete (the host or the adder, isHostOrAdder) and sends only the answer (ADR 0011).
  it("lets the viewer the page allowed request deletion", async () => {
    renderCard(true);
    fireEvent.click(screen.getByRole("button", { name: "곡 삭제" }));
    await waitFor(() => expect(removeSong).toHaveBeenCalledWith("song", "playlist", "share"));
  });

  it("does not expose deletion to a viewer the page did not allow", () => {
    renderCard(false);
    expect(screen.queryByRole("button", { name: "곡 삭제" })).not.toBeInTheDocument();
  });
});
