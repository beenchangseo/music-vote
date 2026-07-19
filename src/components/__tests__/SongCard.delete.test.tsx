// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongCard from "../SongCard";
import type { SongWithScore } from "@/lib/types";

const removeSong = vi.fn();
vi.mock("@/actions/song", () => ({ removeSong: (...args: unknown[]) => removeSong(...args) }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showDanger: vi.fn().mockResolvedValue(true), showAlert: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));
vi.mock("../YouTubePlayer", () => ({ default: () => null }));
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
  added_by_user_id: "adder",
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
  commentCount: 0,
  versionCount: 0,
} satisfies SongWithScore;

function renderCard(overrides: { isAdmin: boolean; currentUserId: string }) {
  return render(
    <SongCard song={song} nickname="멤버" shareCode="share" playlistId="playlist" isAdmin={overrides.isAdmin} adminToken={null} currentUserId={overrides.currentUserId} viewMode="card" isPlaying={false} isCurrent={false} onTogglePlay={() => undefined} />,
  );
}

describe("SongCard deletion permission", () => {
  beforeEach(() => removeSong.mockReset().mockResolvedValue({ success: true }));
  afterEach(cleanup);

  it("lets a logged-in host request deletion even without a legacy admin token", async () => {
    renderCard({ isAdmin: true, currentUserId: "host" });
    fireEvent.click(screen.getByRole("button", { name: "곡 삭제" }));
    await waitFor(() => expect(removeSong).toHaveBeenCalledWith("song", "playlist", null, "share"));
  });

  it("lets the song adder request deletion", async () => {
    renderCard({ isAdmin: false, currentUserId: "adder" });
    fireEvent.click(screen.getByRole("button", { name: "곡 삭제" }));
    await waitFor(() => expect(removeSong).toHaveBeenCalled());
  });

  it("does not expose deletion to another participant", () => {
    renderCard({ isAdmin: false, currentUserId: "other" });
    expect(screen.queryByRole("button", { name: "곡 삭제" })).not.toBeInTheDocument();
  });
});
