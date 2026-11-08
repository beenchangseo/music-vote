// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTruncated } from "../useTruncated";

let observers: { callback: () => void; disconnected: boolean }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      entry: { callback: () => void; disconnected: boolean };
      constructor(callback: () => void) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Probe() {
  const [ref, truncated] = useTruncated<HTMLSpanElement>();
  return (
    <>
      <span ref={ref}>드럼 스틱 바꾸고 인이어 다시 맞추기</span>
      <output>{truncated ? "잘림" : "다 보임"}</output>
    </>
  );
}

function setWidths(scrollWidth: number, clientWidth: number) {
  const span = screen.getByText("드럼 스틱 바꾸고 인이어 다시 맞추기");
  Object.defineProperty(span, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(span, "clientWidth", { configurable: true, value: clientWidth });
}

const resize = () => act(() => observers.forEach((o) => !o.disconnected && o.callback()));

describe("useTruncated", () => {
  it("reports a cut label and follows the box as its width changes", () => {
    render(<Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("다 보임");

    setWidths(199, 142);
    resize();
    expect(screen.getByRole("status")).toHaveTextContent("잘림");

    setWidths(199, 199);
    resize();
    expect(screen.getByRole("status")).toHaveTextContent("다 보임");
  });

  it("stops watching once the label is gone", () => {
    const { unmount } = render(<Probe />);
    unmount();
    expect(observers).toHaveLength(1);
    expect(observers[0].disconnected).toBe(true);
  });
});
