// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommentSection from "../CommentSection";
import type { Comment } from "@/domain/types";

vi.mock("@/actions/comment", () => ({ addOrUpdateComment: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));

const theirs: Comment = { id: "c1", song_id: "s1", nickname: "기타", content: "다른 기타의 메모", created_at: "t1", updated_at: "t1", isMine: false };
const mine: Comment = { id: "c2", song_id: "s1", nickname: "기타", content: "내 메모", created_at: "t2", updated_at: "t2", isMine: true };

describe("CommentSection with a namesake", () => {
  afterEach(cleanup);

  it("lists the namesake's comment with the others and edits only mine", () => {
    render(<CommentSection songId="s1" comments={[theirs, mine]} allComments={[theirs, mine]} nickname="기타" shareCode="share" onCommentsChange={() => undefined} />);

    expect(screen.getByText("다른 기타의 메모")).toBeInTheDocument();
    expect(screen.getByText("내 메모")).toBeInTheDocument();
    expect(screen.getAllByText("기타 (나)")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByRole("textbox")).toHaveValue("내 메모");
  });
});
