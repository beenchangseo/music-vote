// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaylistRealtime } from "../usePlaylistRealtime";

const broadcastHandlers: Array<(payload: unknown) => void> = [];
const send = vi.fn(() => Promise.resolve("ok"));
const removeChannel = vi.fn();

const channel = {
  on: vi.fn((_type: string, _opts: { event: string }, cb: (payload: unknown) => void) => {
    broadcastHandlers.push(cb);
    return channel;
  }),
  subscribe: vi.fn(() => channel),
  send,
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: () => channel, removeChannel }),
}));

function Harness({ onRemoteChange }: { onRemoteChange: () => void }) {
  const { notifyChange } = usePlaylistRealtime("share", onRemoteChange);
  return (
    <button type="button" onClick={notifyChange}>
      알리기
    </button>
  );
}

function emitRemoteChange() {
  act(() => {
    broadcastHandlers.forEach((handler) => handler({}));
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("usePlaylistRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    broadcastHandlers.length = 0;
    send.mockClear();
    removeChannel.mockClear();
    setHidden(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("collapses a burst of remote changes into a single refresh", () => {
    const onRemoteChange = vi.fn();
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    emitRemoteChange();
    emitRemoteChange();
    expect(onRemoteChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("waits until the tab is visible again before refreshing", () => {
    const onRemoteChange = vi.fn();
    render(<Harness onRemoteChange={onRemoteChange} />);

    setHidden(true);
    emitRemoteChange();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onRemoteChange).not.toHaveBeenCalled();

    setHidden(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("broadcasts an empty payload so voter identity never travels", () => {
    render(<Harness onRemoteChange={() => undefined} />);

    act(() => {
      document.querySelector("button")?.click();
    });

    expect(send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "playlist_changed",
      payload: {},
    });
  });
});
