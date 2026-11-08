import { describe, expect, it } from "vitest";
import { canOpenLab, parseLabUserIds } from "../lab-access";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("parseLabUserIds", () => {
  it.each([
    { case: "unset", raw: undefined, ids: [] },
    { case: "empty", raw: "", ids: [] },
    { case: "only commas and spaces", raw: " , ,, ", ids: [] },
    { case: "one id", raw: A, ids: [A] },
    { case: "two ids with spaces around them", raw: ` ${A} ,${B} `, ids: [A, B] },
    { case: "a trailing comma", raw: `${A},`, ids: [A] },
    { case: "an upper-case id, as copied from a dashboard", raw: A.toUpperCase(), ids: [A] },
    { case: "words, numbers and a near-uuid", raw: `admin, 123, ${A.slice(0, -1)}g, ${A}x`, ids: [] },
    { case: "a bad entry next to a good one", raw: `operator, ${B}`, ids: [B] },
  ])("$case → $ids", ({ raw, ids }) => {
    expect([...parseLabUserIds(raw)]).toEqual(ids);
  });
});

describe("canOpenLab", () => {
  it.each([
    { case: "logged out", user: null, raw: A, open: false },
    { case: "logged in, not listed", user: B, raw: A, open: false },
    { case: "listed", user: A, raw: `${B},${A}`, open: true },
    { case: "listed in upper case", user: A, raw: A.toUpperCase(), open: true },
    { case: "the list is unset", user: A, raw: undefined, open: false },
    { case: "the list holds only junk", user: A, raw: "all, *", open: false },
  ])("$case → $open", ({ user, raw, open }) => {
    expect(canOpenLab(user, parseLabUserIds(raw))).toBe(open);
  });
});
