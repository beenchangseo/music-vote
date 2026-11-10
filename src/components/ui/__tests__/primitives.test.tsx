// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Link from "next/link";
import { ActionTab } from "../ActionTab";
import Badge from "../Badge";
import Button, { buttonClassName, touchTarget44 } from "../Button";
import ButtonGroup from "../ButtonGroup";
import Card from "../Card";
import Chip from "../Chip";
import IconButton from "../IconButton";
import Input from "../Input";
import { ListRowButton, ListRowIcon, ListRowLink, SongRow, SongRowLink } from "../ListRow";
import { MenuItemButton, MenuItemLink } from "../Menu";
import RoundButton, { RoundLink } from "../RoundButton";
import { ToolbarButton } from "../ScreenToolbar";
import SegmentedControl from "../SegmentedControl";
import Shelf from "../Shelf";
import Switch from "../Switch";
import TabBar from "../TabBar";

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

  it("submits the form it sits in only when asked to with type=submit", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button variant="ghost">다시 고르기</Button>
        <Button type="submit">밴드 만들기</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 고르기" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "밴드 만들기" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
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

  it("keeps the small bare danger button named, clickable and out of form submit", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <IconButton bare tone="danger" size="sm" aria-label="삭제" onClick={onClick}>
          ⊖
        </IconButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("RoundButton", () => {
  it("is named by aria-label, runs onClick and does not submit the form it sits in", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <RoundButton tone="tonal" size="lg" aria-label="BPM 5 내리기" onClick={onClick}>
          -5
        </RoundButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "BPM 5 내리기" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("says whether a toggle is on, and only a toggle says so", () => {
    const { rerender } = render(
      <>
        <RoundButton size="md" pressed={false} aria-label="셔플">
          <svg />
        </RoundButton>
        <RoundButton tone="plain" size="lg" aria-label="다음 곡">
          <svg />
        </RoundButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "셔플" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "다음 곡" })).not.toHaveAttribute("aria-pressed");
    rerender(
      <RoundButton size="md" pressed aria-label="셔플">
        <svg />
      </RoundButton>,
    );
    expect(screen.getByRole("button", { name: "셔플" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores clicks when disabled", () => {
    const onClick = vi.fn();
    render(
      <RoundButton tone="primary" size="hero" aria-label="메트로놈 시작" disabled onClick={onClick}>
        <svg />
      </RoundButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "메트로놈 시작" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("draws a link as a named link to its href", () => {
    render(
      <RoundLink href="/" tone="ghost" size="md" edge="start" aria-label="홈으로">
        <svg />
      </RoundLink>,
    );
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
  });

  it("only compiles the looks on the ladder", () => {
    // @ts-expect-error A hero is always a disc.
    void (<RoundButton tone="plain" size="hero" aria-label="재생"><svg /></RoundButton>);
    // @ts-expect-error A toggle shows its state by glyph colour, so it has no disc tone.
    void (<RoundButton tone="tonal" size="md" pressed aria-label="셔플"><svg /></RoundButton>);
    // @ts-expect-error Only a bare glyph lines up with the content edge.
    void (<RoundButton tone="tonal" size="lg" edge="start" aria-label="메뉴"><svg /></RoundButton>);
    // @ts-expect-error An icon-only control needs a name.
    void (<RoundButton tone="plain" size="md"><svg /></RoundButton>);
    // @ts-expect-error A link is not a toggle.
    void (<RoundLink href="/" size="md" pressed aria-label="홈으로"><svg /></RoundLink>);
    // @ts-expect-error The look decides the size, so there is no inline style to override it.
    void (<RoundButton tone="plain" size="md" aria-label="다음 곡" style={{ width: 60 }}><svg /></RoundButton>);
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

  it("reads a sheet choice by its words, not its icon tile, and does nothing while disabled", () => {
    const onClick = vi.fn();
    render(
      <ListRowButton disabled onClick={onClick} leading={<ListRowIcon>♪</ListRowIcon>}>
        <span className="block">자작곡</span>
        <span className="block">우리 곡 한 블록</span>
      </ListRowButton>,
    );
    const row = screen.getByRole("button", { name: "자작곡우리 곡 한 블록" });
    expect(row.querySelector("div, p")).toBeNull();
    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
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

// jsdom has no layout, so these read the classes. Every small control draws the one shared tap area, and that area is
// never under control-md (44px, pinned to globals.css by tokens.test) on either side.
describe("controls drawn smaller than 44px", () => {
  it("share one tap area that is at least 44×44 around the control", () => {
    expect(touchTarget44.split(" ")).toEqual(
      expect.arrayContaining(["relative", "after:absolute", "after:size-full", "after:min-h-control-md", "after:min-w-control-md"]),
    );
  });

  it.each([
    ["IconButton sm", () => render(<IconButton size="sm" bare aria-label="삭제">⊖</IconButton>), "삭제"],
    ["Button sm", () => render(<Button size="sm">더 보기</Button>), "더 보기"],
    ["Chip", () => render(<Chip>C</Chip>), "C"],
    ["Switch", () => render(<Switch checked={false} onCheckedChange={() => {}} aria-label="익명 투표" />), "익명 투표"],
  ])("%s keeps that tap area", (_name, draw, name) => {
    draw();
    const control = screen.getByRole(name === "익명 투표" ? "switch" : "button", { name });
    expect(control.className.split(/\s+/)).toEqual(expect.arrayContaining(touchTarget44.split(" ")));
  });
});

// #79: a label that wraps inside a fixed-height control spills out of it. jsdom has no layout, so this reads what CSS
// would: the nearest white-space class between the label's text and the control must be nowrap.
function labelWhiteSpace(text: HTMLElement): string | undefined {
  for (let el: HTMLElement | null = text; el; el = el.parentElement) {
    const found = el.className.match(/(?:^|\s)(?:whitespace|text)-(nowrap|normal|pre|pre-line|pre-wrap|break-spaces|wrap|balance|pretty)(?:\s|$)/);
    if (found) return found[1];
  }
  return undefined;
}

describe("control labels stay on one line (#79)", () => {
  it.each([
    ["Button lg", () => render(<Button size="lg">플레이리스트 만들기</Button>)],
    ["Button sm", () => render(<Button size="sm">플레이리스트 만들기</Button>)],
    ["a link drawn with buttonClassName", () => render(<Link href="/new" className={buttonClassName({ variant: "tonal" })}>플레이리스트 만들기</Link>)],
    ["ToolbarButton", () => render(<ToolbarButton label="플레이리스트 만들기" />)],
    ["Chip", () => render(<Chip>플레이리스트 만들기</Chip>)],
    [
      "SegmentedControl",
      () => render(<SegmentedControl aria-label="방식" options={[{ value: "a", label: "플레이리스트 만들기" }, { value: "b", label: "밴드" }]} value="a" onChange={() => {}} />),
    ],
    ["TabBar", () => render(<TabBar aria-label="화면" items={[{ id: "a", label: "플레이리스트 만들기", icon: null }]} value="a" onChange={() => {}} />)],
    ["ActionTab", () => render(<ActionTab icon={null} onClick={() => {}}>플레이리스트 만들기</ActionTab>)],
    ["MenuItemButton", () => render(<MenuItemButton>플레이리스트 만들기</MenuItemButton>)],
    ["MenuItemLink", () => render(<MenuItemLink href="/new">플레이리스트 만들기</MenuItemLink>)],
    ["Badge", () => render(<Badge>플레이리스트 만들기</Badge>)],
  ])("%s", (_name, draw) => {
    draw();
    expect(labelWhiteSpace(screen.getByText("플레이리스트 만들기"))).toBe("nowrap");
  });

  // min-width: fit-content is min(max-content, max(min-content, row)). A short label keeps its button at least label
  // wide, so the row breaks into one button per line; a truncating band name is capped at the row and gives way.
  // min-w-max would push that button past the screen (min-width beats Button's max-w-full).
  it("ButtonGroup keeps each button at least as wide as its label, up to the row, and lets the row break into one button per line", () => {
    render(
      <ButtonGroup>
        <Button>플레이리스트 만들기</Button>
        <Button variant="tonal">밴드 만들기</Button>
      </ButtonGroup>,
    );
    const group = screen.getByRole("button", { name: "플레이리스트 만들기" }).parentElement!;
    expect(group.className.split(/\s+/)).toEqual(expect.arrayContaining(["flex-wrap", "*:min-w-fit", "*:grow"]));
    expect(group.className).not.toMatch(/\*:min-w-(0|max)(\s|$)/);
  });

  it("ButtonGroup lets a Button's truncating band name shrink to the row", () => {
    const name = "아주아주긴밴드이름".repeat(5);
    render(
      <ButtonGroup>
        <Button variant="tonal">
          <span className="flex min-w-0">
            <span className="truncate">{name}</span>에 넣기
          </span>
        </Button>
        <Button variant="ghost">취소</Button>
      </ButtonGroup>,
    );
    const button = screen.getByRole("button", { name: `${name}에 넣기` });
    // Every box from the button down to the truncate span may be narrower than its text.
    expect(button.parentElement!.className).toMatch(/(^|\s)\*:min-w-fit(\s|$)/);
    expect(button.className).toMatch(/(^|\s)max-w-full(\s|$)/);
    const cells: string[] = [];
    for (let el = screen.getByText(name).parentElement; el && el !== button; el = el.parentElement) cells.push(el.className);
    expect(cells.every((cls) => /(^|\s)(min-w-0|max-w-full)(\s|$)/.test(cls))).toBe(true);
  });
});

describe("SongRow surface", () => {
  it("keeps the opened row's footer inside the same row, under the title", () => {
    render(
      <SongRow role="group" aria-label="예뻤어 행" surface="open" cover={null} footer={<button type="button">댓글</button>}>
        <span>예뻤어</span>
      </SongRow>,
    );
    const row = screen.getByRole("group", { name: "예뻤어 행" });
    expect(within(row).getByText("예뻤어")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "댓글" })).toBeInTheDocument();
  });

  it("SongRowLink is one link to its href around the whole row", () => {
    render(
      <SongRowLink href="/playlist/abc" cover={null} trailing={<span>3번</span>}>
        <span>예뻤어</span>
      </SongRowLink>,
    );
    const link = screen.getByRole("link", { name: /예뻤어/ });
    expect(link).toHaveAttribute("href", "/playlist/abc");
    expect(link).toHaveTextContent("3번");
  });
});

describe("Shelf", () => {
  it("holds the screen-reader-only text of its cards inside its own sideways scroll (#97)", () => {
    render(
      <Shelf>
        <li>
          <span>11월 정기합주</span>
          <span className="sr-only">,</span> 후보곡
        </li>
      </Shelf>,
    );
    expect(
      screen.getByRole("list").className.split(/\s+/),
      "sr-only text is position:absolute, so a static Shelf does not clip it and a card past the right edge widens the page past a 390px screen",
    ).toContain("relative");
  });
});
