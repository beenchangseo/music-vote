// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetlistEditAccess } from "@/domain/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import SetlistView from "../SetlistView";

const editList = vi.hoisted(() => ({ loads: vi.fn() }));

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ insertSetlistBlock: vi.fn(), removeSetlistItem: vi.fn(), updateSetlistOrder: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("../SetlistShareButton", () => ({ default: () => null }));
vi.mock("../SetlistEditList", async (importOriginal) => {
  editList.loads();
  return importOriginal();
});

const song = (id: string, title: string) =>
  ({ id, title, artist: "밴드", thumbnail_url: null, duration_seconds: 240, tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, score: 0 }) as unknown as SongWithScore;
const songs = [song("pretty", "예뻤어"), song("cherry", "벚꽃 엔딩")];
const at = (position: number, songId: string) =>
  ({ id: `item-${position}`, playlist_id: "p", position, item_type: "song", song_id: songId, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

function renderSetlist(access: SetlistEditAccess) {
  render(
    <SetlistView
      setlistItems={[at(0, "pretty"), at(1, "cherry")]}
      songs={songs}
      playlistId="p"
      shareCode="abc123"
      loading={false}
      onItemsChange={vi.fn()}
      title="10월 합주"
      access={access}
    />,
  );
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

afterEach(cleanup);

// Its own file, in this order: the edit list module loads once per file, and these tests are about that first load.
describe("SetlistView edit list loading", () => {
  it("never downloads the drag-and-drop edit list for a member who can only read the setlist", async () => {
    renderSetlist("read_only");
    await settle();

    expect(editList.loads).not.toHaveBeenCalled();
  });

  it("fetches the edit list for an editor once 편집 shows, and keeps the view list on screen until it is ready", async () => {
    renderSetlist("edit");
    await vi.waitFor(() => expect(editList.loads).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "편집" }));

    expect(screen.getAllByTestId("rail-start")).toHaveLength(2);
    expect(await screen.findByRole("button", { name: "「벚꽃 엔딩」 끌어서 순서 바꾸기" })).toBeInTheDocument();
    expect(screen.queryByTestId("rail-start")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "완료" })).toHaveAttribute("aria-pressed", "true");
    expect(editList.loads).toHaveBeenCalledTimes(1);
  });
});
