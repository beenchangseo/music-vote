// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Button from "../Button";
import Card from "../Card";
import Chip from "../Chip";
import IconButton from "../IconButton";
import Input from "../Input";
import { ListRowButton, ListRowLink } from "../ListRow";

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

  it("says whether a toggle is on, and is a toggle only where its off look differs from the primary on look", () => {
    const { rerender } = render(<Button variant="tonal" pressed={false}>메트로놈</Button>);
    expect(screen.getByRole("button", { name: "메트로놈" })).toHaveAttribute("aria-pressed", "false");
    rerender(<Button variant="tonal" pressed>메트로놈</Button>);
    expect(screen.getByRole("button", { name: "메트로놈" })).toHaveAttribute("aria-pressed", "true");

    // @ts-expect-error A button without a variant is primary, which already looks pressed.
    void (<Button pressed>켜기</Button>);
    // @ts-expect-error Kakao keeps its brand yellow.
    void (<Button variant="kakao" pressed={false}>공유</Button>);
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

describe("Card", () => {
  it("keeps what is being typed above its footer when the footer opens and closes", () => {
    const card = (footer: React.ReactNode) => (
      <Card footer={footer}>
        <input aria-label="메모" />
      </Card>
    );
    const { rerender } = render(card(null));
    const memo = screen.getByRole("textbox", { name: "메모" });
    memo.focus();
    fireEvent.change(memo, { target: { value: "브릿지" } });

    rerender(card(<p>코멘트</p>));
    expect(screen.getByText("코멘트")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "메모" })).toHaveValue("브릿지");
    expect(screen.getByRole("textbox", { name: "메모" })).toHaveFocus();

    rerender(card(false));
    expect(screen.queryByText("코멘트")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "메모" })).toHaveValue("브릿지");
    expect(screen.getByRole("textbox", { name: "메모" })).toHaveFocus();
  });
});

describe("ListRowButton", () => {
  it("is one button that does not submit a form, with only phrasing content inside", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onClick = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <ListRowButton leading={<span>2</span>} trailing={<span>4:56</span>} onClick={onClick}>
          <span className="block">벚꽃 엔딩</span>
        </ListRowButton>
      </form>,
    );
    const row = screen.getByRole("button", { name: /벚꽃 엔딩/ });
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    // A <button> may hold only phrasing content. A <div> inside it is invalid HTML.
    expect(row.querySelector("div, p, h1, h2, h3, ul, li")).toBeNull();
  });
});

describe("ListRowLink", () => {
  it("is one link to its href, drawn as the same 56px row as ListRowButton", () => {
    render(
      <>
        <ListRowLink href="/playlist/abc" leading={<span>2</span>} trailing={<span>4:56</span>}>
          <span className="block">벚꽃 엔딩</span>
        </ListRowLink>
        <ListRowButton leading={<span>2</span>}>예뻤어</ListRowButton>
      </>,
    );
    const link = screen.getByRole("link", { name: /벚꽃 엔딩/ });
    expect(link).toHaveAttribute("href", "/playlist/abc");
    expect(link.className).toBe(screen.getByRole("button", { name: /예뻤어/ }).className);
  });
});
