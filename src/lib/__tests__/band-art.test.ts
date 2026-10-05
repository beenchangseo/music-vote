import { describe, expect, it } from "vitest";
import { assignAvatarColors, avatarInitial, bandPalette, stableHash } from "../band-art";

describe("band-art", () => {
  it("gives a band the same palette every time", () => {
    const id = "afbb0574-14b1-4dfa-88b7-b53d7a9ea641";
    expect(bandPalette(id)).toBe(bandPalette(id));
    expect(stableHash(id)).toBe(stableHash(id));
  });

  it("keeps avatar colors apart inside one band up to eight members", () => {
    const names = ["서창빈", "지민", "현우", "소연", "Alex", "보컬", "드럼", "베이스"];
    expect(new Set(assignAvatarColors(names)).size).toBe(8);
    // The same list always paints the same way.
    expect(assignAvatarColors(names)).toEqual(assignAvatarColors(names));
  });

  it("still returns a color for every member past eight", () => {
    const names = Array.from({ length: 10 }, (_, i) => `멤버${i}`);
    expect(assignAvatarColors(names)).toHaveLength(10);
  });

  it("uses the first character for the avatar", () => {
    expect(avatarInitial(" 서창빈")).toBe("서");
    expect(avatarInitial("alex")).toBe("A");
    expect(avatarInitial("  ")).toBe("?");
  });
});
