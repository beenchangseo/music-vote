// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Switch from "../Switch";

afterEach(cleanup);

function Controlled({ initial = false, onChange = () => {} }: { initial?: boolean; onChange?: (next: boolean) => void }) {
  const [on, setOn] = useState(initial);
  return (
    <Switch
      label="익명 투표"
      description="누가 투표했는지 안 보여요."
      checked={on}
      onCheckedChange={(next) => {
        onChange(next);
        setOn(next);
      }}
    />
  );
}

describe("Switch", () => {
  it("is a switch named by its label that reports its state", () => {
    render(<Controlled initial />);
    const toggle = screen.getByRole("switch", { name: "익명 투표" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAccessibleDescription("누가 투표했는지 안 보여요.");
  });

  it("flips on click and hands the next value to the caller", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "익명 투표" });

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("flips when the row text is tapped, not only the track", () => {
    render(<Controlled />);
    fireEvent.click(screen.getByText("누가 투표했는지 안 보여요."));
    expect(screen.getByRole("switch", { name: "익명 투표" })).toHaveAttribute("aria-checked", "true");
  });

  it("ignores clicks while disabled", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="알림" checked={false} onCheckedChange={onCheckedChange} disabled />);
    fireEvent.click(screen.getByRole("switch", { name: "알림" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("does not submit the form it sits in", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Switch aria-label="알림" checked={false} onCheckedChange={() => {}} />
      </form>,
    );
    fireEvent.click(screen.getByRole("switch", { name: "알림" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
