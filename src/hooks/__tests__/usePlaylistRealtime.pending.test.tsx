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
  const { requestRefresh } = usePlaylistRealtime("share", onRemoteChange);
  return (
    <button type="button" onClick={requestRefresh}>
      요청
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

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("usePlaylistRealtime pendingRef", () => {
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

  it("a change notified during an in-flight refresh (nothing pending) is refreshed 1s after that refresh started", async () => {
    let finish: () => void = () => {};
    const onRemoteChange = vi.fn().mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve))).mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);

    await tick(500);
    emitRemoteChange();
    await tick(499);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);

    await act(async () => finish());
    await tick(60_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);
  });

  it("a retry pending at unmount never fires", async () => {
    const onRemoteChange = vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValue(undefined);
    const { unmount } = render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
    await tick(2000);
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    await tick(120_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("a change missed while hidden during a pending retry refreshes right when the tab is back, and the cleared retry stays quiet", async () => {
    const onRemoteChange = vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);

    await tick(1000);
    setHidden(true);
    emitRemoteChange();
    await tick(1000);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);

    setHidden(false);
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);

    await tick(120_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);
  });

  it("an ordinary refresh pending when an in-flight one fails replaces that retry; a second failure then backs off from 10s", async () => {
    let fail: (e: Error) => void = () => {};
    const onRemoteChange = vi
      .fn()
      .mockReturnValueOnce(new Promise<void>((_, reject) => (fail = reject)))
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);

    await tick(500);
    emitRemoteChange();
    await act(async () => fail(new Error("500")));
    await tick(499);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);

    await tick(9_999);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(onRemoteChange).toHaveBeenCalledTimes(3);
    await tick(120_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(3);
  });

  it("a burst of changes during a pending retry collapses into one refresh (no timer stacking)", async () => {
    const onRemoteChange = vi
      .fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    await tick(5000);
    await tick(10_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(3);

    await tick(1000);
    emitRemoteChange();
    emitRemoteChange();
    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(4);
    await tick(120_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(4);
  });

  it("a notified refresh that succeeds mid-backoff resets the backoff to 5s", async () => {
    const onRemoteChange = vi
      .fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    await tick(5000);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);

    await tick(1000);
    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(3);

    await tick(1000);
    emitRemoteChange();
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(4);
    await tick(4_999);
    expect(onRemoteChange).toHaveBeenCalledTimes(4);
    await tick(1);
    expect(onRemoteChange).toHaveBeenCalledTimes(5);
  });

  it("requestRefresh behaves like a notification against a pending retry", async () => {
    const onRemoteChange = vi.fn().mockRejectedValueOnce(new Error("500")).mockRejectedValueOnce(new Error("500")).mockResolvedValue(undefined);
    render(<Harness onRemoteChange={onRemoteChange} />);

    emitRemoteChange();
    await tick(0);
    await tick(5000);
    expect(onRemoteChange).toHaveBeenCalledTimes(2);

    await tick(1000);
    act(() => {
      document.querySelector("button")?.click();
    });
    await tick(0);
    expect(onRemoteChange).toHaveBeenCalledTimes(3);
    await tick(120_000);
    expect(onRemoteChange).toHaveBeenCalledTimes(3);
  });
});
