// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import * as icons from "../icons";
import { chevronPointing } from "./chevron-pointing";

afterEach(cleanup);

const REQUIRED_PROPS: Record<string, object> = {
  ChevronIcon: { direction: "right" },
  PlayPauseIcon: { playing: false },
  SkipIcon: { direction: "next" },
};

const components = Object.entries(icons).filter(([name]) => name.endsWith("Icon")) as [string, ComponentType<object>][];

describe("icons", () => {
  // Every icon sits beside a label or inside a named button, so a screen reader must skip the drawing.
  it.each(components)("%s draws one svg hidden from screen readers", (name, Icon) => {
    const { container } = render(<Icon {...REQUIRED_PROPS[name]} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0].getAttribute("aria-hidden")).toBe("true");
  });

  it.each(["up", "down", "left", "right"] as const)("ChevronIcon direction=%s points that way on screen", (direction) => {
    const { container } = render(<icons.ChevronIcon direction={direction} />);
    expect(chevronPointing(container.querySelector("svg")!)).toBe(direction);
  });
});
