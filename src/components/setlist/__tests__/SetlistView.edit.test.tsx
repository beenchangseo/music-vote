// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertSetlistBlock, removeSetlistItem, updateSetlistOrder } from "@/actions/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import SetlistView from "../SetlistView";

const dialog = vi.hoisted(() => ({ showAlert: vi.fn(), showDanger: vi.fn() }));

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ insertSetlistBlock: vi.fn(), removeSetlistItem: vi.fn(), updateSetlistOrder: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => dialog }));
vi.mock("../SetlistShareButton", () => ({ default: () => null }));

const song = (id: string, title: string, duration_seconds: number) =>
  ({ id, title, artist: "밴드", thumbnail_url: null, duration_seconds, tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, score: 0 }) as unknown as SongWithScore;
const songs = [song("pretty", "예뻤어", 284), song("cherry", "벚꽃 엔딩", 296), song("love", "사랑하긴 했었나요", 250)];

const at = (position: number, fields: Partial<SetlistItem>) =>
  ({ id: `item-${position}`, playlist_id: "p", position, item_type: "song", song_id: null, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "", ...fields }) as SetlistItem;

const pretty = at(0, { song_id: "pretty" });
const hidden = at(1, { song_id: null });
const interval = at(2, { item_type: "interval", label: "기타 셋업 변경", duration_seconds: 60 });
const cherry = at(3, { song_id: "cherry" });
const setlist = [pretty, hidden, interval, cherry];

function Room({ initial, onItemsChange }: { initial: SetlistItem[]; onItemsChange: (items: SetlistItem[]) => void }) {
  const [items, setItems] = useState(initial);
  return (
    <SetlistView
      setlistItems={items}
      songs={songs}
      playlistId="p"
      shareCode="abc123"
      adminToken={null}
      loading={false}
      onItemsChange={(next) => {
        onItemsChange(next);
        setItems(next);
      }}
      title="10월 합주"
      access="edit"
      onPlay={vi.fn()}
    />
  );
}

function renderRoom(initial: SetlistItem[] = setlist, { edit = true } = {}) {
  const onItemsChange = vi.fn();
  render(<Room initial={initial} onItemsChange={onItemsChange} />);
  if (edit) fireEvent.click(screen.getByRole("button", { name: "편집" }));
  return onItemsChange;
}

const list = () => screen.getByRole("list", { name: "셋리스트" });
const handles = () => within(list()).getAllByRole("button", { name: /끌어서 순서 바꾸기$/ }).map((button) => button.getAttribute("aria-label"));
const tick = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const rowOf = (handleName: string) => screen.getByRole("button", { name: handleName }).closest("li") as HTMLElement;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  // jsdom has no layout. Lay rows out by their place in the list so the keyboard sensor can find neighbours.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const rows = [...document.querySelectorAll('ol[aria-label="셋리스트"] > li')];
    const index = Math.max(0, rows.findIndex((row) => row.contains(this)));
    return { x: 0, y: index * 100, top: index * 100, left: 0, width: 320, height: 90, right: 320, bottom: index * 100 + 90, toJSON() {} } as DOMRect;
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(insertSetlistBlock).mockReset();
  vi.mocked(updateSetlistOrder).mockReset();
  vi.mocked(removeSetlistItem).mockReset();
  dialog.showAlert.mockReset();
  dialog.showDanger.mockReset();
});

describe("SetlistView edit mode: (+) rows", () => {
  it("puts a (+) above every drawn block and one at the end, and none outside edit mode", () => {
    renderRoom(setlist, { edit: false });
    expect(screen.queryByRole("button", { name: "맨 끝에 넣기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "편집" }));

    expect(screen.getAllByRole("button", { name: /에 넣기$/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "맨 앞에 넣기",
      "「예뻤어」 다음에 넣기",
      "「기타 셋업 변경」 다음에 넣기",
      "맨 끝에 넣기",
    ]);
    expect(screen.getByText("≡ 를 끌어 순서를 바꾸고, (+) 로 그 자리에 넣어요")).toBeInTheDocument();
  });

  it("inserts an interval at the (+) it was opened from and focuses the new block", async () => {
    const onItemsChange = renderRoom();
    const added = at(9, { id: "new", item_type: "interval", label: "멘트", duration_seconds: 60 });
    const after = [pretty, hidden, { ...added, position: 2 }, { ...interval, position: 3 }, { ...cherry, position: 4 }];
    vi.mocked(insertSetlistBlock).mockResolvedValue({ success: true, itemId: "new", items: after });

    fireEvent.click(screen.getByRole("button", { name: "「예뻤어」 다음에 넣기" }));
    const sheet = screen.getByRole("dialog", { name: "여기에 넣기" });
    expect(sheet).toHaveTextContent("「예뻤어」 다음 · 4:44 에 시작");

    fireEvent.click(within(sheet).getByRole("button", { name: /인터벌/ }));
    expect(within(sheet).getByLabelText("분")).toHaveValue("1");
    expect(within(sheet).getByLabelText("초")).toHaveValue("0");
    fireEvent.change(within(sheet).getByLabelText("이름"), { target: { value: "멘트" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "넣기" }));

    await waitFor(() => expect(onItemsChange).toHaveBeenCalledWith(after));
    expect(insertSetlistBlock).toHaveBeenCalledWith("p", { before: "item-2" }, { kind: "interval", label: "멘트", description: "", durationSeconds: 60 }, "abc123");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(handles()).toEqual(["「예뻤어」 끌어서 순서 바꾸기", "「멘트」 끌어서 순서 바꾸기", "「기타 셋업 변경」 끌어서 순서 바꾸기", "「벚꽃 엔딩」 끌어서 순서 바꾸기"]);
    expect(screen.getByRole("button", { name: "「멘트」 끌어서 순서 바꾸기" })).toHaveFocus();
    expect(screen.getByText("「멘트」 블록을 넣었어요")).toHaveAttribute("role", "status");
  });

  it("offers only candidates not in the setlist and inserts the picked one at that spot", async () => {
    renderRoom();
    vi.mocked(insertSetlistBlock).mockResolvedValue({ success: true, itemId: "new", items: setlist });

    fireEvent.click(screen.getByRole("button", { name: "맨 앞에 넣기" }));
    const sheet = screen.getByRole("dialog", { name: "여기에 넣기" });
    expect(sheet).toHaveTextContent("맨 앞 · 0:00 에 시작");
    fireEvent.click(within(sheet).getByRole("button", { name: /후보곡에서 고르기/ }));

    expect(within(sheet).queryByText("예뻤어")).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "사랑하긴 했었나요 넣기" }));

    await waitFor(() => expect(insertSetlistBlock).toHaveBeenCalledWith("p", { before: "item-0" }, { kind: "song", songId: "love" }, "abc123"));
  });

  it("keeps the sheet open with the reason when the insert is refused", async () => {
    const onItemsChange = renderRoom();
    vi.mocked(insertSetlistBlock).mockResolvedValue({ success: false, reason: "not_editor" });

    fireEvent.click(screen.getByRole("button", { name: "맨 끝에 넣기" }));
    const sheet = screen.getByRole("dialog", { name: "여기에 넣기" });
    fireEvent.click(within(sheet).getByRole("button", { name: /자작곡/ }));
    expect(within(sheet).getByLabelText("분")).toHaveValue("3");
    fireEvent.change(within(sheet).getByLabelText("이름"), { target: { value: "우리 곡" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "넣기" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("방장만 셋리스트를 편집할 수 있어요");
    expect(insertSetlistBlock).toHaveBeenCalledWith("p", { before: null }, { kind: "original", label: "우리 곡", description: "", durationSeconds: 180 }, "abc123");
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("closes the sheet and says so when the block under the (+) is gone", async () => {
    renderRoom();
    vi.mocked(insertSetlistBlock).mockResolvedValue({ success: false, reason: "slot_gone" });

    fireEvent.click(screen.getByRole("button", { name: "맨 앞에 넣기" }));
    fireEvent.click(screen.getByRole("button", { name: /후보곡에서 고르기/ }));
    fireEvent.click(screen.getByRole("button", { name: "사랑하긴 했었나요 넣기" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dialog.showAlert).toHaveBeenCalledWith("그 사이 셋리스트가 바뀌었어요. 넣을 자리를 다시 골라 주세요");
  });
});

describe("SetlistView edit mode: reordering", () => {
  it("gives every block a handle in the rail cell instead of ▲▼ and start times", () => {
    renderRoom();

    expect(handles()).toEqual(["「예뻤어」 끌어서 순서 바꾸기", "「기타 셋업 변경」 끌어서 순서 바꾸기", "「벚꽃 엔딩」 끌어서 순서 바꾸기"]);
    expect(screen.queryByRole("button", { name: "위로" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "아래로" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("rail-start")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rail-end")).not.toBeInTheDocument();
  });

  it("moves a block two places down from the keyboard, keeps the deleted song in its slot, and saves the whole order", async () => {
    const onItemsChange = renderRoom();
    const saved = [{ ...interval, position: 0 }, { ...hidden, position: 1 }, { ...cherry, position: 2 }, { ...pretty, position: 3 }];
    vi.mocked(updateSetlistOrder).mockResolvedValue({ success: true, items: saved });

    const handle = screen.getByRole("button", { name: "「예뻤어」 끌어서 순서 바꾸기" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await tick();
    expect(document.body).toHaveTextContent("「예뻤어」 블록을 들었어요");
    for (const key of ["ArrowDown", "ArrowDown", "Space"]) {
      fireEvent.keyDown(document, { code: key, key: key === "Space" ? " " : key });
      await tick();
    }

    await waitFor(() => expect(onItemsChange).toHaveBeenCalledWith(saved));
    expect(updateSetlistOrder).toHaveBeenCalledWith("p", null, ["item-2", "item-1", "item-3", "item-0"], "abc123");
    expect(handles()).toEqual(["「기타 셋업 변경」 끌어서 순서 바꾸기", "「벚꽃 엔딩」 끌어서 순서 바꾸기", "「예뻤어」 끌어서 순서 바꾸기"]);
    expect(document.body).toHaveTextContent("「예뻤어」 블록을 3번째에 놓았어요");
  });

  it("saves nothing when the move is cancelled with Escape", async () => {
    renderRoom();

    const handle = screen.getByRole("button", { name: "「벚꽃 엔딩」 끌어서 순서 바꾸기" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await tick();
    fireEvent.keyDown(document, { code: "ArrowUp", key: "ArrowUp" });
    await tick();
    fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
    await tick();

    expect(updateSetlistOrder).not.toHaveBeenCalled();
    expect(handles()).toEqual(["「예뻤어」 끌어서 순서 바꾸기", "「기타 셋업 변경」 끌어서 순서 바꾸기", "「벚꽃 엔딩」 끌어서 순서 바꾸기"]);
  });

  it("puts the order back and says why when the save is refused", async () => {
    const onItemsChange = renderRoom();
    vi.mocked(updateSetlistOrder).mockResolvedValue({ success: false, reason: "not_editor" });

    const handle = screen.getByRole("button", { name: "「벚꽃 엔딩」 끌어서 순서 바꾸기" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await tick();
    for (const key of ["ArrowUp", "Space"]) {
      fireEvent.keyDown(document, { code: key, key: key === "Space" ? " " : key });
      await tick();
    }

    await waitFor(() => expect(dialog.showAlert).toHaveBeenCalledWith("방장만 셋리스트를 편집할 수 있어요"));
    await waitFor(() => expect(handles()).toEqual(["「예뻤어」 끌어서 순서 바꾸기", "「기타 셋업 변경」 끌어서 순서 바꾸기", "「벚꽃 엔딩」 끌어서 순서 바꾸기"]));
    expect(onItemsChange).not.toHaveBeenCalled();
  });
});

describe("SetlistView edit mode: removing", () => {
  it("hides the block at once and then draws the setlist the server returns", async () => {
    const onItemsChange = renderRoom();
    dialog.showDanger.mockResolvedValue(true);
    const saved = deferred<{ success: true; items: SetlistItem[] }>();
    vi.mocked(removeSetlistItem).mockReturnValue(saved.promise);

    fireEvent.click(within(rowOf("「기타 셋업 변경」 끌어서 순서 바꾸기")).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(handles()).toEqual(["「예뻤어」 끌어서 순서 바꾸기", "「벚꽃 엔딩」 끌어서 순서 바꾸기"]));
    expect(onItemsChange).not.toHaveBeenCalled();

    const after = [pretty, hidden, { ...cherry, position: 2 }];
    await act(async () => saved.resolve({ success: true, items: after }));

    expect(removeSetlistItem).toHaveBeenCalledWith("p", null, "item-2", "abc123");
    expect(onItemsChange).toHaveBeenCalledWith(after);
  });

  it("puts the block back and says why when the delete is refused", async () => {
    const onItemsChange = renderRoom();
    dialog.showDanger.mockResolvedValue(true);
    vi.mocked(removeSetlistItem).mockResolvedValue({ success: false, reason: "not_editor" });

    fireEvent.click(within(rowOf("「벚꽃 엔딩」 끌어서 순서 바꾸기")).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(dialog.showAlert).toHaveBeenCalledWith("방장만 셋리스트를 편집할 수 있어요"));
    await waitFor(() => expect(handles()).toHaveLength(3));
    expect(onItemsChange).not.toHaveBeenCalled();
  });
});

describe("SetlistView add areas", () => {
  it("keeps the bottom add buttons for an empty setlist and opens the sheet on that form", () => {
    renderRoom([], { edit: false });

    fireEvent.click(screen.getByRole("button", { name: "인터벌 블록 추가" }));

    const sheet = screen.getByRole("dialog", { name: "여기에 넣기" });
    expect(sheet).toHaveTextContent("맨 앞 · 0:00 에 시작");
    expect(within(sheet).getByLabelText("이름")).toBeInTheDocument();
  });

  it("hands focus to 편집 after the first block lands in an empty setlist, and says what was added", async () => {
    renderRoom([], { edit: false });
    const added = at(0, { id: "new", item_type: "interval", label: "멘트", duration_seconds: 60 });
    vi.mocked(insertSetlistBlock).mockResolvedValue({ success: true, itemId: "new", items: [added] });

    const opener = screen.getByRole("button", { name: "인터벌 블록 추가" });
    opener.focus();
    fireEvent.click(opener);
    const sheet = screen.getByRole("dialog", { name: "여기에 넣기" });
    fireEvent.change(within(sheet).getByLabelText("이름"), { target: { value: "멘트" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "넣기" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "편집" })).toHaveFocus();
    expect(screen.getByText("「멘트」 블록을 넣었어요")).toHaveAttribute("role", "status");
  });

  it("drops the bottom add buttons once the setlist has blocks, and hides the candidate list while editing", () => {
    renderRoom(setlist, { edit: false });

    expect(screen.queryByRole("button", { name: "인터벌 블록 추가" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "후보곡에서 넣기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "편집" }));

    expect(screen.queryByRole("heading", { name: "후보곡에서 넣기" })).not.toBeInTheDocument();
  });

  it("appends a suggested candidate at the end", async () => {
    const onItemsChange = renderRoom(setlist, { edit: false });
    vi.mocked(insertSetlistBlock).mockResolvedValue({ success: true, itemId: "new", items: setlist });

    fireEvent.click(screen.getByRole("button", { name: "사랑하긴 했었나요 셋리스트에 넣기" }));

    await waitFor(() => expect(onItemsChange).toHaveBeenCalledWith(setlist));
    expect(insertSetlistBlock).toHaveBeenCalledWith("p", { before: null }, { kind: "song", songId: "love" }, "abc123");
  });
});
