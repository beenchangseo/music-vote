// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BAND_PROMPT_COOKIE,
  addDismissal,
  dismissBandPrompt,
  hasBandPromptDismissal,
  migrateLegacyDismissal,
  parseDismissals,
  serializeDismissals,
} from "../prompt-dismissals";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1);
const B = id(2);

function clearCookie() {
  document.cookie = `${BAND_PROMPT_COOKIE}=; Path=/; Max-Age=0`;
}

beforeEach(() => {
  clearCookie();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDismissals", () => {
  it.each([
    [undefined, []],
    ["", []],
    ["not-a-uuid", []],
    [`${A}.junk.${B}`, [A, B]],
    [`${A}.${A}`, [A]],
  ])("reads %j as %j, dropping anything that is not a playlist id", (value, expected) => {
    expect(parseDismissals(value)).toEqual(expected);
  });

  it("keeps only the latest 50 even from a hand-made cookie", () => {
    const value = serializeDismissals(Array.from({ length: 60 }, (_, i) => id(i)));
    const ids = parseDismissals(value);
    expect(ids).toHaveLength(50);
    expect(ids[0]).toBe(id(10));
  });
});

describe("addDismissal", () => {
  it("adds once, moving a repeat to the newest end", () => {
    expect(addDismissal([A, B], A)).toEqual([B, A]);
  });

  it("drops the oldest past 50", () => {
    const full = Array.from({ length: 50 }, (_, i) => id(i));
    const next = addDismissal(full, id(99));
    expect(next).toHaveLength(50);
    expect(next[0]).toBe(id(1));
    expect(next.at(-1)).toBe(id(99));
  });

  it("ignores something that is not a playlist id", () => {
    expect(addDismissal([A], "x;Path=/")).toEqual([A]);
  });
});

describe("in the browser", () => {
  it("remembers a closed card in the cookie the server reads", () => {
    dismissBandPrompt(A);
    dismissBandPrompt(B);
    expect(document.cookie).toContain(`${BAND_PROMPT_COOKIE}=${A}.${B}`);
    expect(hasBandPromptDismissal(A)).toBe(true);
    expect(hasBandPromptDismissal(id(3))).toBe(false);
  });

  it("moves a card closed before the cookie existed (localStorage) into the cookie, once (O5)", () => {
    window.localStorage.setItem(`plypick:band-prompt-dismissed:${A}`, "1");
    expect(hasBandPromptDismissal(A)).toBe(true);
    migrateLegacyDismissal(A);
    expect(parseDismissals(document.cookie.split("=")[1])).toEqual([A]);
    expect(hasBandPromptDismissal(A)).toBe(true);
    expect(window.localStorage.getItem(`plypick:band-prompt-dismissed:${A}`)).toBeNull();
  });

  it("says not closed when storage is blocked, instead of throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasBandPromptDismissal(A)).toBe(false);
    expect(() => migrateLegacyDismissal(A)).not.toThrow();
  });
});
