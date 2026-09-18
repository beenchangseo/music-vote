// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VoteButtons from "../VoteButtons";

const castVote = vi.fn();
const showAlert = vi.fn();
vi.mock("@/actions/vote", () => ({ castVote: (...args: unknown[]) => castVote(...args) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/kakao-login", () => ({ triggerKakaoLogin: vi.fn() }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showAlert }) }));

describe("VoteButtons repeated allocated votes", () => {
  beforeEach(() => {
    showAlert.mockReset();
    castVote.mockReset().mockResolvedValue({
      success: true,
      allowance: { usedVotes: 1, voteLimit: 44 },
    });
  });
  afterEach(cleanup);

  it("adds the same direction repeatedly and cancels one with the opposite arrow", async () => {
    const onVoteOptimistic = vi.fn();
    render(
      <VoteButtons
        songId="song"
        score={0}
        userVote={null}
        userVoteCount={0}
        votingMode="allocated"
        nickname="참여자"
        shareCode="share"
        onVoteOptimistic={onVoteOptimistic}
      />,
    );

    const up = screen.getByRole("button", { name: "찬성표 추가" });
    fireEvent.click(up);
    await waitFor(() => expect(up).toBeEnabled());
    fireEvent.click(up);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(2));

    expect(screen.getByText("2")).toBeInTheDocument();
    const down = screen.getByRole("button", { name: "찬성표 한 개 취소" });
    await waitFor(() => expect(down).toBeEnabled());
    fireEvent.click(down);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(3));

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(onVoteOptimistic.mock.calls.map((call) => call[1])).toEqual([1, 1, -1]);
  });

  it("blocks only a new vote when the allowance is exhausted", async () => {
    render(
      <VoteButtons
        songId="song"
        score={1}
        userVote={1}
        userVoteCount={1}
        votingMode="allocated"
        allowance={{ mode: "allocated", usedVotes: 1, voteLimit: 1 }}
        nickname="참여자"
        shareCode="share"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));
    expect(castVote).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      "투표권을 모두 사용했어요. 기존 표를 취소하면 다시 투표할 수 있어요.",
    );

    fireEvent.click(screen.getByRole("button", { name: "찬성표 한 개 취소" }));
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(1));
  });

  it("shows a friendly message and rolls back when the server rejects a stale request", async () => {
    const onVoteOptimistic = vi.fn();
    castVote.mockResolvedValueOnce({
      success: false,
      reason: "vote_limit_reached",
    });

    render(
      <VoteButtons
        songId="song"
        score={0}
        userVote={null}
        userVoteCount={0}
        votingMode="allocated"
        allowance={null}
        nickname="참여자"
        shareCode="share"
        onVoteOptimistic={onVoteOptimistic}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "찬성표 추가" }));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        "투표권을 모두 사용했어요. 기존 표를 취소하면 다시 투표할 수 있어요.",
      );
    });
    expect(onVoteOptimistic.mock.calls.map((call) => call[1])).toEqual([1, -1]);
  });
});
