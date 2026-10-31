import { describe, expect, it } from "vitest";
import { compareTimestamps } from "../timestamp";

const WHOLE = "2026-10-01T00:00:00+00:00";
const HALF = "2026-10-01T00:00:00.5+00:00";

describe("compareTimestamps", () => {
  it.each([
    ["a whole second is earlier than a fraction of it (Postgres drops a zero fraction)", WHOLE, HALF, -1],
    ["a fraction of a second is later than the whole second", HALF, WHOLE, 1],
    ["a client Z time is earlier than a fraction of the same second", "2026-10-01T00:00:00Z", HALF, -1],
    ["the same instant written with Z and +00:00 ties", "2026-10-01T00:00:00.000Z", WHOLE, 0],
    ["the same instant written with another offset ties", "2026-10-01T09:00:00+09:00", WHOLE, 0],
    ["the same text ties", HALF, HALF, 0],
    ["an earlier second is earlier, whatever its fraction", "2026-09-30T23:59:59.999+00:00", WHOLE, -1],
    ["a missing time comes before any time", null, WHOLE, -1],
    ["any time comes after a missing one", WHOLE, null, 1],
    ["two missing times tie", null, null, 0],
  ] as const)("%s", (_case, a, b, order) => {
    expect(Math.sign(compareTimestamps(a, b))).toBe(order);
  });
});
