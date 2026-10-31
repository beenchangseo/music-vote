import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLORS, HEIGHTS, MOTION, RADII, SHADOWS, TYPE, contrastRatio } from "../tokens";

const css = readFileSync(fileURLToPath(new URL("../../../app/globals.css", import.meta.url)), "utf8");
const cssVar = (name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

describe("contrastRatio", () => {
  it("matches the WCAG reference points", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });
});

describe("tokens.ts agrees with globals.css", () => {
  it.each([...COLORS.values()].map((t) => [t.name, t.hex]))("--color-%s is %s", (name, hex) => {
    expect(cssVar(`--color-${name}`)?.toLowerCase()).toBe(hex);
  });

  it.each([...TYPE, ...RADII, ...HEIGHTS, ...SHADOWS, ...MOTION].filter((t) => t.cssVar).map((t) => [t.cssVar, t.value]))("%s is %s", (v, value) => {
    expect(cssVar(v)).toBe(value);
  });
});

describe("color pairings", () => {
  const rows = [...COLORS.values()].flatMap((t) =>
    t.pairs.map((p) => ({ fg: t, on: p.against, min: p.min })),
  );

  it.each(rows.map((r) => [r.fg.name, r.on, r.min, r]))("%s on %s reaches %s:1", (_a, _b, _c, r) => {
    const on = COLORS.get(r.on);
    expect(on, `${r.on} is not a token`).toBeDefined();
    expect(on!.layer, "a pairing puts a fg color on a bg color").not.toBe(r.fg.layer);
    expect(contrastRatio(r.fg.hex, on!.hex)).toBeGreaterThanOrEqual(r.min);
  });

  const avoided = [...COLORS.values()].flatMap((t) => (t.avoid ?? []).map((p) => ({ fg: t, on: p.against, min: p.min })));
  it.each(avoided.map((r) => [r.fg.name, r.on, r]))("%s on %s still fails, so the rule against it stands", (_a, _b, r) => {
    expect(contrastRatio(r.fg.hex, COLORS.get(r.on)!.hex)).toBeLessThan(r.min);
  });
});
