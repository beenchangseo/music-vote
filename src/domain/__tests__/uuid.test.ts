import { describe, expect, it } from "vitest";
import { isUuidFormat } from "../uuid";

describe("isUuidFormat", () => {
  it.each([
    ["a uuid", "22222222-2222-4222-8222-222222222222", true],
    ["upper case uuid", "3F2B8C1E-6A4D-4F0E-9B7A-2C1D5E8F9A01", true],
    ["a share code", "qDPJnh1d", false],
    ["a uuid without hyphens", "22222222222242228222222222222222", false],
    ["a uuid with a path after it", "22222222-2222-4222-8222-222222222222/x", false],
    ["empty", "", false],
  ])("%s → %s", (_label, id, expected) => {
    expect(isUuidFormat(id)).toBe(expected);
  });
});
