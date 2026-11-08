import { describe, expect, it } from "vitest";
import { isPastDeadline } from "../deadline";

const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("isPastDeadline", () => {
  // The deadline instant itself is still open, as in cast_playlist_vote (v24) and the auto-confirm cron.
  it.each([
    ["no deadline", false, null],
    ["a deadline still ahead", false, "2026-11-08T12:00:00.001Z"],
    ["the deadline instant", false, "2026-11-08T12:00:00.000Z"],
    ["Postgres's offset form of the same instant", false, "2026-11-08T21:00:00+09:00"],
    ["one millisecond past", true, "2026-11-08T11:59:59.999Z"],
    ["a day past", true, "2026-11-07T12:00:00+00:00"],
  ])("%s → %s", (_label, expected, deadline) => {
    expect(isPastDeadline(deadline, NOW)).toBe(expected);
  });
});
