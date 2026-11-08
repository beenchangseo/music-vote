// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetlistItem } from "@/domain/types";
import SetlistView from "../SetlistView";

// jsdom lays nothing out, so whether the browser cut the label is decided here.
const measured = vi.hoisted(() => ({ cut: false }));
vi.mock("@/hooks/useTruncated", () => ({ useTruncated: () => [() => undefined, measured.cut] }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/actions/setlist", () => ({ insertSetlistBlock: vi.fn(), removeSetlistItem: vi.fn(), updateSetlistOrder: vi.fn() }));
vi.mock("../../ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn(), showDanger: vi.fn() }) }));
vi.mock("../SetlistShareButton", () => ({ default: () => null }));

const interval = (label: string, duration_seconds: number) =>
  ({ id: "i", playlist_id: "p", position: 0, item_type: "interval", song_id: null, label, description: null, duration_seconds, title_override: null, duration_override_seconds: null, created_at: "" }) as SetlistItem;

function renderInterval(label: string, duration_seconds: number) {
  render(
    <SetlistView
      setlistItems={[interval(label, duration_seconds)]}
      songs={[]}
      playlistId="p"
      shareCode="abc123"
      loading={false}
      onItemsChange={vi.fn()}
      title="10월 합주"
      access="read_only"
      onPlay={vi.fn()}
    />,
  );
  return within(screen.getByRole("list", { name: "셋리스트" })).getByRole("listitem");
}

afterEach(() => {
  cleanup();
  measured.cut = false;
});

describe("SetlistView interval name that does not fit", () => {
  it("unfolds a short name the screen cut, and folds it back", () => {
    measured.cut = true;
    const block = renderInterval("드럼 스틱 바꾸고 인이어 다시 맞추기", 90);
    const row = within(block).getByRole("button", { name: /^드럼 스틱 바꾸고 인이어 다시 맞추기/ });
    expect(row).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(row).toHaveTextContent(/^드럼 스틱 바꾸고 인이어 다시 맞추기 · 1:30$/);

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
  });

  it("draws no toggle for a long name the screen shows in full", () => {
    const block = renderInterval("앵콜 전에 멘트하고 관객이랑 같이 사진 찍고 물 마시고 오기", 150);

    expect(within(block).queryByRole("button")).not.toBeInTheDocument();
    expect(block).toHaveTextContent("앵콜 전에 멘트하고 관객이랑 같이 사진 찍고 물 마시고 오기 · 2:30");
  });
});
