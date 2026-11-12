// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlaylistActionRow from "../PlaylistActionRow";

afterEach(cleanup);

const share = <button type="button">공유</button>;
const notice = <button type="button">공지사항</button>;

describe("PlaylistActionRow", () => {
  it("draws no ⋯ when its sheet would be empty", () => {
    render(<PlaylistActionRow title="11월 합주" share={share} notice={notice} menu={[]} />);
    expect(screen.queryByRole("button", { name: "플레이리스트 메뉴" })).not.toBeInTheDocument();
  });

  it("opens ⋯ as a sheet of its rows and closes it on the picked row", () => {
    const onSelect = vi.fn();
    render(<PlaylistActionRow title="11월 합주" share={share} notice={notice} menu={[{ label: "카드 보기", icon: null, onSelect }]} />);

    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "11월 합주" })).getByRole("button", { name: "카드 보기" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("plays under the label it is given and offers 일시정지 while playing", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <PlaylistActionRow title="11월 합주" share={share} notice={notice} menu={[]} play={{ label: "전체 듣기", playing: false, onClick }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "전체 듣기" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<PlaylistActionRow title="11월 합주" share={share} notice={notice} menu={[]} play={{ label: "전체 듣기", playing: true, onClick }} />);
    expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument();
  });

  it("puts share, edit and ⋯ before the notice and play, in that order", () => {
    render(
      <PlaylistActionRow
        title="11월 합주"
        share={share}
        edit={<button type="button">편집</button>}
        notice={notice}
        menu={[{ label: "카드 보기", icon: null, onSelect: vi.fn() }]}
        play={{ label: "전체 듣기", playing: false, onClick: vi.fn() }}
      />,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual([
      "공유",
      "편집",
      "플레이리스트 메뉴",
      "공지사항",
      "전체 듣기",
    ]);
  });
});
