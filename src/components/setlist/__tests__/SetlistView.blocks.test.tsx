// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSetlistOrder } from "@/actions/setlist";
import type { SetlistEditAccess } from "@/domain/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import SetlistView from "../SetlistView";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ addSongToSetlist: vi.fn(), removeSetlistItem: vi.fn(), updateSetlistOrder: vi.fn() }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("../SetlistShareButton", () => ({ default: () => null }));

const song = (id: string, title: string, artist: string, duration_seconds: number) =>
  ({ id, title, artist, thumbnail_url: null, duration_seconds, tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, score: 0 }) as unknown as SongWithScore;
const songs = [song("pretty", "예뻤어", "DAY6", 284), song("cherry", "벚꽃 엔딩", "버스커 버스커", 296)];

const at = (position: number, fields: Partial<SetlistItem>) =>
  ({ id: `item-${position}`, playlist_id: "p", position, item_type: "song", song_id: null, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "", ...fields }) as SetlistItem;

function renderSetlist(setlistItems: SetlistItem[], access: SetlistEditAccess = "read_only", onItemsChange = vi.fn()) {
  render(
    <SetlistView
      setlistItems={setlistItems}
      songs={songs}
      playlistId="p"
      shareCode="abc123"
      adminToken={null}
      loading={false}
      onItemsChange={onItemsChange}
      title="10월 합주"
      access={access}
      onPlay={vi.fn()}
    />,
  );
  return onItemsChange;
}

const setlistBlocks = () => within(screen.getByRole("list", { name: "셋리스트" })).getAllByRole("listitem");

afterEach(() => {
  cleanup();
  vi.mocked(updateSetlistOrder).mockReset();
});

describe("SetlistView blocks", () => {
  const setlist = [
    at(0, { song_id: "pretty" }),
    at(1, { item_type: "interval", label: "기타 셋업 변경", duration_seconds: 60 }),
    at(2, { song_id: "cherry" }),
    at(3, { item_type: "original", label: "우리 자작곡", description: "브릿지 두 번", duration_seconds: 210 }),
  ];

  it("draws a song block as a playable card with its length beside the artist", () => {
    renderSetlist(setlist);
    const [first] = setlistBlocks();

    expect(within(first).getByRole("button", { name: "예뻤어 재생" })).toBeInTheDocument();
    expect(first).toHaveTextContent("DAY6 · 4:44");
  });

  it("draws an interval and an original as their own cards, neither playable", () => {
    renderSetlist(setlist);
    const [, interval, , original] = setlistBlocks();

    expect(interval).toHaveTextContent("기타 셋업 변경 · 1:00");
    expect(original).toHaveTextContent("자작곡 · 3:30");
    expect(original).toHaveTextContent("브릿지 두 번");
    for (const block of [interval, original]) expect(within(block).queryByRole("button", { name: /재생/ })).not.toBeInTheDocument();
  });

  it("puts each block's start time on the rail and the total at its end, without order numbers", () => {
    renderSetlist(setlist);
    const blocks = setlistBlocks();

    expect(blocks.map((block) => within(block).getByTestId("rail-start").textContent)).toEqual(["0:00", "4:44", "5:44", "10:40"]);
    expect(screen.getByTestId("rail-end")).toHaveTextContent("14:10");
    expect(within(blocks[2]).queryByText("2")).not.toBeInTheDocument();
  });
});

describe("SetlistView with a song deleted from the candidates", () => {
  const setlist = [
    at(0, { song_id: null }),
    at(1, { song_id: "pretty" }),
    at(2, { song_id: null }),
    at(3, { item_type: "interval", label: "멘트", duration_seconds: 60 }),
    at(4, { song_id: "cherry" }),
  ];
  const visible = new Set(["item-1", "item-3", "item-4"]);

  it("runs the rail through the deleted songs and counts only the blocks it draws", () => {
    renderSetlist(setlist);

    expect(setlistBlocks().map((block) => within(block).getByTestId("rail-start").textContent)).toEqual(["0:00", "4:44", "5:44"]);
    expect(screen.getByTestId("rail-end")).toHaveTextContent("10:40");
    expect(screen.getByText("2곡").parentElement).toHaveTextContent(/^2곡· 인터벌 1$/);
  });

  it("treats a setlist of deleted songs as empty", () => {
    renderSetlist([at(0, { song_id: null })], "edit");

    expect(screen.getByText("셋리스트가 비어있어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집" })).not.toBeInTheDocument();
  });

  it("moves a block past a deleted song in one press", async () => {
    const onItemsChange = renderSetlist(setlist, "edit");
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    const [first, interval, last] = setlistBlocks();

    expect(within(first).getByRole("button", { name: "위로" })).toBeDisabled();
    expect(within(last).getByRole("button", { name: "아래로" })).toBeDisabled();

    fireEvent.click(within(interval).getByRole("button", { name: "위로" }));

    const reordered: SetlistItem[] = onItemsChange.mock.calls[0][0];
    const shown = [...reordered].sort((x, y) => x.position - y.position).filter((item) => visible.has(item.id));
    expect(shown.map((item) => item.id)).toEqual(["item-3", "item-1", "item-4"]);
    await waitFor(() => expect(updateSetlistOrder).toHaveBeenCalled());
    const ids: string[] = vi.mocked(updateSetlistOrder).mock.calls[0][2];
    expect(ids.filter((id) => visible.has(id))).toEqual(["item-3", "item-1", "item-4"]);
    expect([...ids].sort()).toEqual(setlist.map((item) => item.id).sort());
  });
});

describe("SetlistView edit mode", () => {
  const setlist = [at(0, { song_id: "pretty" }), at(1, { item_type: "interval", label: "멘트", duration_seconds: 60 }), at(2, { item_type: "original", label: "자작곡" })];

  it("trades the rail for remove and reorder controls on every block", () => {
    renderSetlist(setlist, "edit");
    expect(screen.queryAllByRole("button", { name: "삭제" })).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "편집" }));

    for (const block of setlistBlocks()) {
      expect(within(block).getByRole("button", { name: "삭제" })).toBeInTheDocument();
      expect(within(block).getByRole("button", { name: "위로" })).toBeInTheDocument();
      expect(within(block).getByRole("button", { name: "아래로" })).toBeInTheDocument();
      expect(within(block).queryByTestId("rail-start")).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId("rail-end")).not.toBeInTheDocument();
  });

  it("leaves only 완료 in the toolbar while editing", () => {
    renderSetlist(setlist, "edit");
    fireEvent.click(screen.getByRole("button", { name: "편집" }));

    expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "셋리 전체 듣기" })).not.toBeInTheDocument();
  });
});
