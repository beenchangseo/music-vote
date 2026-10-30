// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import VoteAllowanceStatus from "../VoteAllowanceStatus";

describe("VoteAllowanceStatus", () => {
  afterEach(cleanup);

  it("explains how to recover when every vote is used", () => {
    render(
      <VoteAllowanceStatus
        allowance={{ mode: "allocated", usedVotes: 3, voteLimit: 3 }}
      />,
    );

    expect(screen.getByText("투표권을 모두 사용했어요")).toBeInTheDocument();
    expect(screen.getByText("기존 표를 취소하면 다시 투표할 수 있어요.")).toBeInTheDocument();
  });
});
