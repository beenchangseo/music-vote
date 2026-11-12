// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetlistEditAccess } from "@/domain/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import SetlistView from "../SetlistView";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ insertSetlistBlock: vi.fn(), removeSetlistItem: vi.fn(), updateSetlistOrder: vi.fn() }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn() }) }));

const song = (id: string, title: string, duration_seconds: number) =>
  ({ id, title, artist: "아티스트", thumbnail_url: null, duration_seconds, tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, score: 0 }) as unknown as SongWithScore;
const songs = [song("a", "첫차를 기다리며", 220), song("b", "파란 신호등", 245)];

const at = (position: number, fields: Partial<SetlistItem>) =>
  ({ id: `item-${position}`, playlist_id: "p", position, item_type: "song", song_id: null, label: null, description: null, duration_seconds: 90, title_override: null, duration_override_seconds: null, created_at: "", ...fields }) as SetlistItem;

const ITEMS = [at(0, { song_id: "a" }), at(1, { item_type: "interval", label: "인사" }), at(2, { song_id: "b" })];

function renderSetlist({ access = "edit", onOpenSettings }: { access?: SetlistEditAccess; onOpenSettings?: () => void } = {}) {
  render(
    <SetlistView
      setlistItems={ITEMS}
      songs={songs}
      playlistId="p"
      shareCode="abc123"
      loading={false}
      onItemsChange={vi.fn()}
      title="11월 정기공연"
      access={access}
      onPlay={vi.fn()}
      notice={<button type="button">공지사항</button>}
      onOpenSettings={onOpenSettings}
    />,
  );
}

afterEach(cleanup);

describe("SetlistView header (#101)", () => {
  it("heads the setlist with its title, song count, runtime and intervals", () => {
    renderSetlist();
    const head = within(screen.getByRole("heading", { level: 1, name: "11월 정기공연" }).parentElement!);
    expect(head.getByText("2곡")).toBeInTheDocument();
    expect(head.getByText("9:15")).toBeInTheDocument();
    expect(head.getByText("인터벌 1")).toBeInTheDocument();
  });

  it("carries the candidates tab's row: export, edit, notice and play, in that order", () => {
    renderSetlist();
    const names = ["셋리스트 내보내기", "편집", "공지사항", "셋리 전체 듣기"];
    const row = names.map((name) => screen.getByRole("button", { name }));
    for (let i = 1; i < row.length; i++) {
      expect(row[i - 1].compareDocumentPosition(row[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("swaps 편집 for 완료 on the same button, pressed", async () => {
    renderSetlist();
    const toggle = screen.getByRole("button", { name: "편집" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(await screen.findByRole("button", { name: "완료" })).toBe(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("offers ⋯ with the playlist settings to whoever can open them", () => {
    const onOpenSettings = vi.fn();
    renderSetlist({ onOpenSettings });
    fireEvent.click(screen.getByRole("button", { name: "플레이리스트 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "플레이리스트 설정" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows no ⋯ to anyone else, since its sheet would be empty", () => {
    renderSetlist({ access: "locked_to_host" });
    expect(screen.queryByRole("button", { name: "플레이리스트 메뉴" })).not.toBeInTheDocument();
    expect(screen.getByText("방장만 편집할 수 있어요")).toBeInTheDocument();
  });
});
