// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import SetlistView from "../SetlistView";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({
  insertSetlistBlock: vi.fn(),
  removeSetlistItem: vi.fn(),
  updateSetlistOrder: vi.fn(),
  updateSongSetlistItem: vi.fn(),
  resetSongSetlistItem: vi.fn(),
  updateIntervalItem: vi.fn(),
  updateOriginalItem: vi.fn(),
}));
const showConfirm = vi.hoisted(() => vi.fn());

vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn(), showConfirm }) }));
vi.mock("../SetlistShareButton", () => ({ default: () => null }));

const song = (id: string, title: string) =>
  ({ id, title, artist: null, thumbnail_url: null, duration_seconds: 240, tempo_bpm: null, key_root: null, key_mode: null, key_memo: null, score: 0 }) as unknown as SongWithScore;
const songs = [
  song("pretty", "DAY6(데이식스)- 예뻤어 [가사/Lyrics]"),
  song("cherry", "버스커 버스커 - 벚꽃 엔딩 [MV]"),
  song("love", "[MV] 4MEN - 사랑하긴 했었나요 (Official Audio)"),
];

const at = (position: number, fields: Partial<SetlistItem>) =>
  ({ id: `item-${position}`, playlist_id: "p", position, item_type: "song", song_id: null, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "", ...fields }) as SetlistItem;

const setlist = [
  at(0, { song_id: "pretty" }),
  at(1, { song_id: "cherry", title_override: "벚꽃 엔딩 (밴드 편곡)" }),
  at(2, { item_type: "interval", label: "멘트", duration_seconds: 60 }),
  at(3, { item_type: "original", label: "우리 노래", duration_seconds: 200 }),
];

function renderSetlist() {
  render(
    <SetlistView
      setlistItems={setlist}
      songs={songs}
      playlistId="p"
      shareCode="abc123"
      adminToken={null}
      loading={false}
      onItemsChange={vi.fn()}
      title="10월 합주"
      access="edit"
      onPlay={vi.fn()}
    />,
  );
}

const list = () => screen.getByRole("list", { name: "셋리스트" });

async function openEditMode() {
  fireEvent.click(screen.getByRole("button", { name: "편집" }));
  await screen.findByRole("button", { name: "맨 끝에 넣기" });
}

afterEach(() => {
  cleanup();
  showConfirm.mockReset();
});

describe("SetlistView song titles", () => {
  it("shows the title the candidates tab shows, or the setlist's own title over it", () => {
    renderSetlist();

    expect(within(list()).getByText("예뻤어")).toBeInTheDocument();
    expect(within(list()).getByText("벚꽃 엔딩 (밴드 편곡)")).toBeInTheDocument();
    expect(list()).not.toHaveTextContent("[가사/Lyrics]");
    expect(screen.getByRole("button", { name: "사랑하긴 했었나요 셋리스트에 넣기" })).toBeInTheDocument();
  });

  it("names every edit button by its block in edit mode and opens the song sheet on that title", async () => {
    renderSetlist();
    await openEditMode();

    expect(within(list()).getAllByRole("button", { name: /고치기$/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "「예뻤어」 제목 고치기",
      "「벚꽃 엔딩 (밴드 편곡)」 제목 고치기",
      "「멘트」 인터벌 고치기",
      "「우리 노래」 자작곡 고치기",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "「예뻤어」 제목 고치기" }));
    const sheet = screen.getByRole("dialog", { name: "곡 블록 수정" });
    expect(within(sheet).getByDisplayValue("예뻤어")).toBeInTheDocument();
  });

  it("warns that reset brings back the title and length the candidates tab shows", async () => {
    renderSetlist();
    await openEditMode();

    fireEvent.click(screen.getByRole("button", { name: "「벚꽃 엔딩 (밴드 편곡)」 제목 고치기" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "곡 블록 수정" })).getByRole("button", { name: "초기화" }));

    expect(showConfirm).toHaveBeenCalledWith("후보곡 탭에 보이는 제목과 영상 길이로 돌아가요.", "고친 제목과 시간을 되돌릴까요?");
  });

  it("offers candidates in the insert sheet by the title the candidates tab shows", async () => {
    renderSetlist();
    await openEditMode();

    fireEvent.click(screen.getByRole("button", { name: "맨 끝에 넣기" }));
    const sheet = screen.getByRole("dialog", { name: "여기에 넣기" });
    fireEvent.click(within(sheet).getByRole("button", { name: /후보곡에서 고르기/ }));

    expect(within(sheet).getByText("사랑하긴 했었나요")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "사랑하긴 했었나요 넣기" })).toBeInTheDocument();
  });
});
