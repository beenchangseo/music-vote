// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Button from "../Button";
import Chip from "../Chip";
import IconButton from "../IconButton";
import Input from "../Input";

afterEach(cleanup);

describe("Button", () => {
  it.each(["primary", "tonal", "ghost", "danger", "kakao"] as const)("%s is a button named by its label that runs onClick", (variant) => {
    const onClick = vi.fn();
    render(<Button variant={variant} onClick={onClick}>저장</Button>);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("while loading, is busy and ignores clicks", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>저장</Button>);
    const button = screen.getByRole("button", { name: "저장" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not busy when idle", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).not.toHaveAttribute("aria-busy");
  });

  it("ignores clicks when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>삭제</Button>);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("marks a Kakao action with the speech bubble whether it is yellow or tonal", () => {
    render(
      <>
        <Button variant="kakao">카톡 공유</Button>
        <Button variant="tonal" kakaoMark>로그인</Button>
        <Button variant="tonal">취소</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "카톡 공유" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "로그인" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "취소" }).querySelector("svg")).toBeNull();
  });
});

describe("Chip", () => {
  it("reports its selected state to assistive tech", () => {
    const { rerender } = render(<Chip>메타 있음</Chip>);
    expect(screen.getByRole("button", { name: "메타 있음" })).toHaveAttribute("aria-pressed", "false");
    rerender(<Chip selected>메타 있음</Chip>);
    expect(screen.getByRole("button", { name: "메타 있음" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not submit the form it sits in", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}><Chip>전체</Chip></form>);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it.each(["default", "danger", "brand"] as const)("%s is named by aria-label and does not submit a form", (tone) => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <IconButton tone={tone} aria-label="닫기">×</IconButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("marks itself invalid for assistive tech", () => {
    const { rerender } = render(<Input aria-label="곡 링크" />);
    expect(screen.getByRole("textbox", { name: "곡 링크" })).not.toHaveAttribute("aria-invalid");
    rerender(<Input aria-label="곡 링크" invalid />);
    expect(screen.getByRole("textbox", { name: "곡 링크" })).toHaveAttribute("aria-invalid", "true");
  });

  it("lets the caller override aria-invalid", () => {
    render(<Input aria-label="곡 링크" invalid aria-invalid="false" />);
    expect(screen.getByRole("textbox", { name: "곡 링크" })).toHaveAttribute("aria-invalid", "false");
  });
});
