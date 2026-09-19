import { describe, expect, it } from "vitest";
import { parseIsoDuration } from "../youtube-data";

describe("parseIsoDuration", () => {
  it("reads the common minutes and seconds form", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT15M33S")).toBe(933);
  });

  it("reads hours for long videos", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT2H")).toBe(7200);
  });

  it("reads days for very long videos", () => {
    expect(parseIsoDuration("P1DT2H")).toBe(93600);
  });

  it("reads a seconds-only value", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
  });

  it("rounds fractional seconds", () => {
    expect(parseIsoDuration("PT1M30.5S")).toBe(91);
  });

  it("treats a zero length as unknown so live streams stay empty", () => {
    expect(parseIsoDuration("P0D")).toBeNull();
    expect(parseIsoDuration("PT0S")).toBeNull();
  });

  it("returns null for values it cannot read", () => {
    expect(parseIsoDuration("")).toBeNull();
    expect(parseIsoDuration("4:13")).toBeNull();
    expect(parseIsoDuration("PTM")).toBeNull();
  });
});
