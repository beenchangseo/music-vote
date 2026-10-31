// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetlistEditAccess } from "@/domain/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import DialogProvider from "../../ui/DialogProvider";
import SetlistView from "../SetlistView";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [vi.fn()] }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({}));

const HOST_ONLY_NOTICE = "방장만 편집할 수 있어요";

const song = { id: "song-1", title: "Plastic Love", artist: "Mariya Takeuchi", duration_seconds: 300, score: 3 } as SongWithScore;
const candidate = { id: "song-2", title: "벚꽃 엔딩", artist: "버스커 버스커", duration_seconds: 296, score: 1 } as SongWithScore;
const item = {
  id: "item-1",
  playlist_id: "room",
  position: 0,
  item_type: "song",
  song_id: song.id,
  label: null,
  description: null,
  duration_seconds: 0,
  title_override: null,
  duration_override_seconds: null,
  created_at: "",
} as SetlistItem;

function renderView(access: SetlistEditAccess, setlistItems: SetlistItem[] = [item]) {
  render(
    <DialogProvider>
      <SetlistView
        setlistItems={setlistItems}
        songs={[song, candidate]}
        playlistId="room"
        shareCode="share"
        adminToken={null}
        loading={false}
        onItemsChange={vi.fn()}
        title="10월 합주"
        access={access}
      />
    </DialogProvider>,
  );
}

function editorControls() {
  return [
    screen.queryByRole("button", { name: "편집" }),
    screen.queryByRole("button", { name: /자작곡 블록 추가/ }),
    screen.queryByRole("heading", { name: "후보곡에서 넣기" }),
  ];
}

describe("SetlistView edit access", () => {
  afterEach(cleanup);

  it("gives an editor the edit controls and no notice", () => {
    renderView("edit");
    for (const control of editorControls()) expect(control).toBeInTheDocument();
    expect(screen.queryByText(HOST_ONLY_NOTICE)).not.toBeInTheDocument();
  });

  it("tells a member of a host-only room that only the host edits, in place of the edit controls", () => {
    renderView("locked_to_host");
    expect(screen.getByText(HOST_ONLY_NOTICE)).toBeInTheDocument();
    for (const control of editorControls()) expect(control).not.toBeInTheDocument();
  });

  it("keeps the notice on an empty setlist", () => {
    renderView("locked_to_host", []);
    expect(screen.getByText(HOST_ONLY_NOTICE)).toBeInTheDocument();
  });

  it("shows neither on a read-only room", () => {
    renderView("read_only");
    expect(screen.queryByText(HOST_ONLY_NOTICE)).not.toBeInTheDocument();
    for (const control of editorControls()) expect(control).not.toBeInTheDocument();
  });
});
