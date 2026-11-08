import { afterEach, describe, expect, it, vi } from "vitest";
import { graphemes, lastWord } from "../text-segments";

const FAMILY = "👨‍👩‍👧";

describe("graphemes", () => {
  it.each([
    ["Korean syllables one by one", "예뻤어", ["예", "뻤", "어"]],
    ["an emoji family as one", `밴드${FAMILY}`, ["밴", "드", FAMILY]],
    ["nothing for an empty string", "", []],
  ])("splits %s", (_, text, expected) => {
    expect(graphemes(text)).toEqual(expected);
  });
});

describe("lastWord", () => {
  it.each([
    ["a single word", "Wonderwall", "Wonderwall"],
    ["the last of several", "Don't Look Back in Anger", "Anger"],
    ["closing punctuation with it", "Love Story (Taylor's Version)", "Version)"],
    ["a Korean word with its bracket", "벚꽃 엔딩 (밴드 편곡)", "편곡)"],
    ["a number", "Song 2", "2"],
    ["nothing without a word", "…", ""],
  ])("takes %s", (_, text, expected) => {
    expect(lastWord(text)).toBe(expected);
  });
});

describe("without Intl.Segmenter (Firefox before 125)", () => {
  const { Segmenter } = Intl;
  afterEach(() => {
    Reflect.set(Intl, "Segmenter", Segmenter);
    vi.resetModules();
  });

  it("splits by code point and takes the last run of non-spaces", async () => {
    Reflect.deleteProperty(Intl, "Segmenter");
    vi.resetModules();
    const fallback = await import("../text-segments");

    expect(fallback.graphemes("예뻤어")).toEqual(["예", "뻤", "어"]);
    expect(fallback.graphemes(FAMILY)).toHaveLength(5);
    expect(fallback.lastWord("Don't Look Back in Anger")).toBe("Anger");
    expect(fallback.lastWord("Love Story (Taylor's Version)")).toBe("Version)");
  });
});
