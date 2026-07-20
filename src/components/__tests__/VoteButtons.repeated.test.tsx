// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VoteButtons from "../VoteButtons";

const castVote = vi.fn();
vi.mock("@/actions/vote", () => ({ castVote: (...args: unknown[]) => castVote(...args) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/kakao-login", () => ({ triggerKakaoLogin: vi.fn() }));
vi.mock("../DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

describe("VoteButtons repeated allocated votes", () => {
  beforeEach(() => {
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
});
