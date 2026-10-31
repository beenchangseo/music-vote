// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SegmentedControl from "../SegmentedControl";

afterEach(cleanup);

type Mode = "free" | "allocated" | "ranked";

function Controlled({ disabled = [] as Mode[], onChange = (() => {}) as (next: Mode) => void }) {
  const [mode, setMode] = useState<Mode>("free");
  return (
    <SegmentedControl<Mode>
      aria-label="투표 방식"
      value={mode}
      onChange={(next) => {
        onChange(next);
        setMode(next);
      }}
      options={[
        { value: "free", label: "자유 투표", disabled: disabled.includes("free") },
        { value: "allocated", label: "투표권 할당", disabled: disabled.includes("allocated") },
        { value: "ranked", label: "순위 투표", disabled: disabled.includes("ranked") },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a named radio group whose checked option matches the value", () => {
    render(<Controlled />);
    expect(screen.getByRole("radiogroup", { name: "투표 방식" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "자유 투표" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "투표권 할당" })).not.toBeChecked();
  });

  it("selects an option on click", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "투표권 할당" }));
    expect(onChange).toHaveBeenCalledWith("allocated");
    expect(screen.getByRole("radio", { name: "투표권 할당" })).toBeChecked();
  });

  it("puts only the checked option in the tab order", () => {
    render(<Controlled />);
    expect(screen.getByRole("radio", { name: "자유 투표" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "투표권 할당" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves and selects with the arrow keys, wrapping at the ends", () => {
    render(<Controlled />);
    const free = screen.getByRole("radio", { name: "자유 투표" });
    free.focus();

    fireEvent.keyDown(free, { key: "ArrowRight" });
    const allocated = screen.getByRole("radio", { name: "투표권 할당" });
    expect(allocated).toBeChecked();
    expect(allocated).toHaveFocus();

    fireEvent.keyDown(allocated, { key: "ArrowLeft" });
    fireEvent.keyDown(free, { key: "ArrowLeft" });
    const ranked = screen.getByRole("radio", { name: "순위 투표" });
    expect(ranked).toBeChecked();
    expect(ranked).toHaveFocus();
  });

  it("skips a disabled option with the arrow keys and ignores clicks on it", () => {
    const onChange = vi.fn();
    render(<Controlled disabled={["allocated"]} onChange={onChange} />);
    const free = screen.getByRole("radio", { name: "자유 투표" });

    fireEvent.click(screen.getByRole("radio", { name: "투표권 할당" }));
    expect(onChange).not.toHaveBeenCalled();

    free.focus();
    fireEvent.keyDown(free, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("ranked");
    expect(screen.getByRole("radio", { name: "순위 투표" })).toHaveFocus();
  });

  it("stays reachable by Tab when the checked option is disabled", () => {
    render(<Controlled disabled={["free"]} />);
    expect(screen.getByRole("radio", { name: "자유 투표" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "투표권 할당" })).toHaveAttribute("tabindex", "0");
  });

  it("does not submit the form it sits in", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Controlled />
      </form>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "순위 투표" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
