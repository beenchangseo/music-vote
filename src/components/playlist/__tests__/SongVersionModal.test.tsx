// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongVersionModal from "../SongVersionModal";
import type { SongVersion } from "@/domain/types";

const getSongVersions = vi.fn();

vi.mock("@/actions/song-version", () => ({
  getSongVersions: (...args: unknown[]) => getSongVersions(...args),
  addSongVersion: vi.fn(),
  updateSongVersion: vi.fn(),
  deleteSongVersion: vi.fn(),
}));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showConfirm: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("../../ui/Modal", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const version = (id: string, title: string, canManage: boolean): SongVersion => ({
  id,
  song_id: "s1",
  youtube_url: `https://youtu.be/${id}`,
  youtube_video_id: id,
  title,
  thumbnail_url: null,
  description: null,
  added_by_nickname: "기타",
  created_at: "t",
  updated_at: "t",
  canManage,
});

describe("SongVersionModal management buttons", () => {
  beforeEach(() => {
    getSongVersions.mockReset().mockResolvedValue([version("v1", "라이브", true), version("v2", "어쿠스틱", false)]);
  });
  afterEach(cleanup);

  // The server decides who manages a version (the host or the person who added it) and sends only the answer (ADR 0011).
  it("offers edit and delete only on versions the server says I manage", async () => {
    render(<SongVersionModal songId="s1" songTitle="곡" shareCode="share" onClose={() => undefined} />);

    const live = (await screen.findByRole("link", { name: "라이브" })).parentElement!;
    const acoustic = screen.getByRole("link", { name: "어쿠스틱" }).parentElement!;
    expect(within(live).getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(within(live).getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(within(acoustic).queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(within(acoustic).queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });
});
