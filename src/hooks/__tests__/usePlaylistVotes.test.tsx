// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaylistVotes } from "../usePlaylistVotes";
import VoteButtons from "@/components/VoteButtons";
import type { SongWithScore, VoteAllowance, VotingMode } from "@/lib/types";

const castVote = vi.fn();
const onError = vi.fn();
vi.mock("@/actions/vote", () => ({ castVote: (...args: unknown[]) => castVote(...args) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/kakao-login", () => ({ triggerKakaoLogin: vi.fn() }));

const VOTE_LIMIT_REACHED_MESSAGE =
  "투표권을 모두 사용했어요. 기존 표를 취소하면 다시 투표할 수 있어요.";

function makeSong(overrides: Partial<SongWithScore> = {}): SongWithScore {
  return {
    id: "song",
    playlist_id: "playlist",
    title: "곡",
    artist: null,
    youtube_url: "https://youtu.be/x",
    youtube_video_id: "x",
    thumbnail_url: null,
    added_by: "참여자",
    added_by_user_id: null,
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
    ...overrides,
  };
}

/** 서버 값은 고정한 채, 훅의 낙관적 상태만 화면에 드러낸다. */
function Harness({
  song,
  votingMode = "allocated",
  allowance = null,
}: {
  song: SongWithScore;
  votingMode?: VotingMode;
  allowance?: VoteAllowance | null;
}) {
  const { songsWithVotes, pressVote, isVotePending } = usePlaylistVotes({
    songs: [song],
    votingMode,
    shareCode: "share",
    nickname: "참여자",
    allowance,
    onAllowanceChange: () => undefined,
    onError,
  });

  return (
    <>
      {songsWithVotes.map((shown) => (
        <VoteButtons
          key={shown.id}
          score={shown.score}
          userVote={shown.userVote}
          userVoteCount={shown.userVoteCount}
          votingMode={votingMode}
          onPress={(direction) => pressVote(shown.id, direction)}
          pending={isVotePending(shown.id)}
        />
      ))}
    </>
  );
}

describe("usePlaylistVotes", () => {
  beforeEach(() => {
    onError.mockReset();
    castVote.mockReset().mockResolvedValue({
      success: true,
      allowance: { usedVotes: 1, voteLimit: 44 },
    });
  });
  afterEach(cleanup);

  it("adds the same direction repeatedly and cancels one with the opposite arrow", async () => {
    render(<Harness song={makeSong()} />);

    const up = screen.getByRole("button", { name: "찬성표 추가" });
    fireEvent.click(up);
    await waitFor(() => expect(up).toBeEnabled());
    fireEvent.click(up);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("status")).toHaveTextContent("2");

    const down = screen.getByRole("button", { name: "찬성표 한 개 취소" });
    await waitFor(() => expect(down).toBeEnabled());
    fireEvent.click(down);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(3));

    expect(screen.getByRole("status")).toHaveTextContent("1");
  });

  it("keeps the free mode toggle to one vote per song", async () => {
    render(<Harness song={makeSong()} votingMode="free" />);

    const up = screen.getByRole("button", { name: "찬성표 추가" });
    fireEvent.click(up);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("1");

    await waitFor(() => expect(up).toBeEnabled());
    fireEvent.click(up);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("0");
  });

  it("blocks only a new vote when the allowance is exhausted", async () => {
    render(
      <Harness
        song={makeSong({ score: 1, userVote: 1, userVoteCount: 1 })}
        allowance={{ mode: "allocated", usedVotes: 1, voteLimit: 1 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));
    expect(castVote).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(VOTE_LIMIT_REACHED_MESSAGE);

    fireEvent.click(screen.getByRole("button", { name: "찬성표 한 개 취소" }));
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(1));
  });

  it("rolls back to the server value when the server rejects a stale request", async () => {
    castVote.mockResolvedValueOnce({ success: false, reason: "vote_limit_reached" });

    render(<Harness song={makeSong()} />);

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));
    expect(screen.getByRole("status")).toHaveTextContent("1");

    await waitFor(() => expect(onError).toHaveBeenCalledWith(VOTE_LIMIT_REACHED_MESSAGE));
    expect(screen.getByRole("status")).toHaveTextContent("0");
  });

  it("drops the optimistic value once the server reports a different score", async () => {
    const { rerender } = render(<Harness song={makeSong()} />);

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("1");

    // 다른 참여자의 표까지 반영된 서버 값이 도착한 경우.
    rerender(<Harness song={makeSong({ score: 5, userVote: 1, userVoteCount: 1 })} />);
    expect(screen.getByRole("status")).toHaveTextContent("5");
  });
});

describe("VoteButtons 잠금 상태", () => {
  afterEach(cleanup);

  it("비로그인이면 잠금 안내가 담긴 레이블을 쓴다", () => {
    render(
      <VoteButtons
        score={3}
        userVote={null}
        userVoteCount={0}
        votingMode="free"
        onPress={() => undefined}
        loginGate
      />,
    );

    expect(screen.getByRole("button", { name: "로그인하고 찬성하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인하고 반대하기" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "점수 3점, 투표하려면 로그인이 필요해요",
    );
  });

  it("로그인 상태에서는 평소 레이블을 쓴다", () => {
    render(
      <VoteButtons
        score={3}
        userVote={null}
        userVoteCount={0}
        votingMode="free"
        onPress={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "찬성표 추가" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("점수 3점");
  });
});
