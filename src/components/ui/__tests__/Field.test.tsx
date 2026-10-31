// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Field from "../Field";
import Input from "../Input";
import Textarea from "../Textarea";

afterEach(cleanup);

describe("Field", () => {
  it("names its control by the label and describes it by the help line", () => {
    render(
      <Field label="플레이리스트 이름" help="단톡방 카드 제목이 돼요.">
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "플레이리스트 이름" });
    expect(input).toHaveAccessibleDescription("단톡방 카드 제목이 돼요.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and reads the error instead of the help line", () => {
    render(
      <Field label="유튜브 링크" help="링크를 붙여 넣어요." error="유튜브 링크를 다시 확인해 주세요.">
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "유튜브 링크" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("유튜브 링크를 다시 확인해 주세요.");
    expect(screen.queryByText("링크를 붙여 넣어요.")).not.toBeInTheDocument();
  });

  it("wires a textarea the same way", () => {
    render(
      <Field label="공지사항" help="최대 500자">
        <Textarea />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "공지사항" })).toHaveAccessibleDescription("최대 500자");
  });

  it("keeps an id the caller gave the control", () => {
    render(
      <Field label="곡 제목">
        <Input id="song-title" />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "곡 제목" })).toHaveAttribute("id", "song-title");
  });
});
