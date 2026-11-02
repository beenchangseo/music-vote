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

function Harness({ onRemoteChange }: { onRemoteChange: () => Promise<void> | void }) {
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

  it("tries a failed refresh again without waiting for another remote change", async () => {
    const onRemoteChange = vi.fn().mockRejectedValueOnce(new Error("429")).mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(onRemoteChange).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(onRemoteChange).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(onRemoteChange).toHaveBeenCalledTimes(2);
  });

  it("waits 5, 10, 20, 40 and then 60 seconds between tries while the refresh keeps failing, and starts over after one succeeds", async () => {
    const onRemoteChange = vi.fn().mockRejectedValue(new Error("500"));
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(onRemoteChange).toHaveBeenCalledTimes(1);

    for (const [retry, delay] of [5000, 10_000, 20_000, 40_000, 60_000, 60_000].entries()) {
      await act(() => vi.advanceTimersByTimeAsync(delay - 1));
      expect(onRemoteChange).toHaveBeenCalledTimes(retry + 1);
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(onRemoteChange).toHaveBeenCalledTimes(retry + 2);
    }

    onRemoteChange.mockResolvedValueOnce(undefined);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(onRemoteChange).toHaveBeenCalledTimes(8);

    emitRemoteChange();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(onRemoteChange).toHaveBeenCalledTimes(9);
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(onRemoteChange).toHaveBeenCalledTimes(9);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(onRemoteChange).toHaveBeenCalledTimes(10);
  });

  it("refreshes a remote change at the normal interval instead of waiting out a backed-off retry, and keeps backing off blind retries", async () => {
    const onRemoteChange = vi
      .fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(onRemoteChange).toHaveBeenCalledTimes(3);

    // The next retry is 20 seconds away when another member's change arrives a second later.
    await act(() => vi.advanceTimersByTimeAsync(1000));
    emitRemoteChange();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(onRemoteChange).toHaveBeenCalledTimes(4);

    await act(() => vi.advanceTimersByTimeAsync(39_999));
    expect(onRemoteChange).toHaveBeenCalledTimes(4);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(onRemoteChange).toHaveBeenCalledTimes(5);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(onRemoteChange).toHaveBeenCalledTimes(5);
  });

  it("does not retry a refresh that fails after the playlist screen is gone", async () => {
    let fail: (reason: Error) => void = () => {};
    const onRemoteChange = vi.fn(() => new Promise<void>((_, reject) => (fail = reject)));
    const { unmount } = render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    unmount();
    await act(async () => fail(new Error("offline")));
    await act(() => vi.advanceTimersByTimeAsync(60_000));

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
