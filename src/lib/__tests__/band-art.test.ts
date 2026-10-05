import { describe, expect, it } from "vitest";
import { avatarInitial } from "../band-art";

describe("avatarInitial", () => {
  it("uses the first character of the name", () => {
    expect(avatarInitial(" 서창빈")).toBe("서");
    expect(avatarInitial("alex")).toBe("A");
    expect(avatarInitial("  ")).toBe("?");
  });
});
