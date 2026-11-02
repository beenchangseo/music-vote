// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommentModal from "../CommentModal";
import type { Comment } from "@/domain/types";

const getCommentsBySong = vi.fn();
const deleteComment = vi.fn();

vi.mock("@/actions/comment", () => ({
  getCommentsBySong: (...args: unknown[]) => getCommentsBySong(...args),
  addOrUpdateComment: vi.fn(),
  deleteComment: (...args: unknown[]) => deleteComment(...args),
}));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn().mockResolvedValue(true) }) }));
vi.mock("../../auth/LoginButton", () => ({ default: () => null }));

// Two members can carry the same Kakao nickname. Only the server knows which comment is the viewer's.
const theirs: Comment = { id: "c1", song_id: "s1", nickname: "기타", content: "다른 기타의 메모", created_at: "t1", updated_at: "t1", isMine: false };
const mine: Comment = { id: "c2", song_id: "s1", nickname: "기타", content: "내 메모", created_at: "t2", updated_at: "t2", isMine: true };

function renderModal() {
  render(<CommentModal songId="s1" songTitle="곡" nickname="기타" shareCode="share" onClose={() => undefined} />);
}

describe("CommentModal with a namesake", () => {
  beforeEach(() => {
    getCommentsBySong.mockReset().mockResolvedValue([theirs, mine]);
    deleteComment.mockReset().mockResolvedValue({ success: true });
  });
  afterEach(cleanup);

  it("shows the namesake's comment as theirs and edits only mine", async () => {
    renderModal();

    expect(await screen.findByText("다른 기타의 메모")).toBeInTheDocument();
    expect(screen.getByText("내 메모")).toBeInTheDocument();
    expect(screen.getAllByText("기타 (나)")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByRole("textbox")).toHaveValue("내 메모");
  });

  it("removes only my comment when I delete", async () => {
    renderModal();
    await screen.findByText("내 메모");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByText("내 메모")).not.toBeInTheDocument());
    expect(deleteComment).toHaveBeenCalledWith("s1", "share");
    expect(screen.getByText("다른 기타의 메모")).toBeInTheDocument();
  });
});
