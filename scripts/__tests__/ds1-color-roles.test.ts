import { describe, expect, it } from "vitest";
import { rewriteClassText, rewriteSource } from "../codemods/ds1-color-roles.mjs";

describe("rewriteClassText", () => {
  it.each([
    ["text-primary", "text-primary-fg"],
    ["hover:text-primary", "hover:text-primary-fg"],
    ["max-[359px]:text-primary", "max-[359px]:text-primary-fg"],
    ["hover:text-primary-hover", "hover:text-on-primary-tint"],
    ["border-t-primary", "border-t-primary-fg"],
    ["focus:ring-primary", "focus:ring-focus-ring"],
    ["focus-visible:ring-primary", "focus-visible:ring-focus-ring"],
    ["focus:border-primary", "focus:border-focus-ring"],
    ["bg-primary-soft", "bg-primary-tint"],
    ["from-primary-soft/60", "from-primary-tint/60"],
    ["to-primary-soft", "to-primary-tint"],
    ["text-danger", "text-danger-fg"],
    ["hover:text-red-400", "hover:text-danger-fg"],
  ])("%s → %s", (from, to) => {
    expect(rewriteClassText(from).text).toBe(to);
  });

  it("drops the opacity of an fg role, since primary-fg at 70% falls under 4.5:1 on surface", () => {
    expect(rewriteClassText("text-primary/70").text).toBe("text-primary-fg");
    expect(rewriteClassText("text-danger/80").text).toBe("text-danger-fg");
    expect(rewriteClassText("from-primary-soft/60").text).toBe("from-primary-tint/60");
  });

  it.each([
    "bg-primary",
    "hover:bg-primary-hover",
    "border-primary",
    "border-primary/30",
    "bg-primary/15",
    "text-primary-fg",
    "text-on-primary",
    "bg-danger",
    "border-danger",
    "accent-primary",
  ])("leaves %s alone", (cls) => {
    expect(rewriteClassText(cls).text).toBe(cls);
  });

  it("keeps the rest of a class list byte for byte", () => {
    expect(rewriteClassText('"border-primary bg-primary/15 text-primary"').text).toBe('"border-primary bg-primary/15 text-primary-fg"');
  });
});

describe("rewriteSource", () => {
  it("rewrites class strings in JSX attributes and template literals", () => {
    const src = 'const a = <p className={`x ${on ? "text-primary" : "text-text"} text-danger`} />;';
    expect(rewriteSource(src).output).toBe('const a = <p className={`x ${on ? "text-primary-fg" : "text-text"} text-danger-fg`} />;');
  });

  it("renames the Button variant secondary to tonal, and only that", () => {
    const src = [
      '<Button variant="secondary" />;',
      'buttonClassName({ variant: user ? "secondary" : "primary" });',
      'const style = { visualStyle: "secondary" };',
      'type V = "primary" | "secondary";',
    ].join("\n");
    expect(rewriteSource(src).output).toBe(
      [
        '<Button variant="tonal" />;',
        'buttonClassName({ variant: user ? "tonal" : "primary" });',
        'const style = { visualStyle: "secondary" };',
        'type V = "primary" | "secondary";',
      ].join("\n"),
    );
  });

  it("finds nothing to do on its own output", () => {
    const src = '<a className="text-primary hover:text-primary-hover focus:ring-primary bg-primary-soft" variant="secondary" />;';
    const once = rewriteSource(src).output;
    expect(rewriteSource(once).hits).toEqual([]);
  });

  it("does not touch comments", () => {
    const src = "// bg-primary-soft was indigo\nconst x = 1;";
    expect(rewriteSource(src).output).toBe(src);
  });
});
