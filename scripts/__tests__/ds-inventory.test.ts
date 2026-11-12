import { describe, expect, it } from "vitest";
import { folderOf, inventory, inventoryOf } from "../ds-inventory.mjs";

const found = async (classes: string, file = "src/components/playlist/Fixture.tsx") =>
  (await inventoryOf(`export const c = "${classes}";`, file)).map((f) => `${f.category} ${f.detail}`);

describe("ds-inventory", () => {
  it.each([
    ["rounded-xl", "non-token rounded-xl"],
    ["rounded-full", "non-token rounded-full"],
    ["rounded", "non-token rounded"],
    ["rounded-t-2xl", "non-token rounded-t-2xl"],
    ["rounded-[4px_14px_14px_14px]", "non-token rounded-[4px_14px_14px_14px]"],
    ["text-lg", "non-token text-lg"],
    ["hover:text-xl", "non-token hover:text-xl"],
    ["text-[10px]", "non-token text-[10px]"],
    ["h-[18px]", "arbitrary h-[18px]"],
    ["-mt-[3px]", "arbitrary -mt-[3px]"],
    ["top-[22px]", "arbitrary top-[22px]"],
    ["pb-[calc(1rem+env(safe-area-inset-bottom))]", "arbitrary pb-[calc(1rem+env(safe-area-inset-bottom))]"],
  ])("lists %s", async (classes, finding) => {
    expect(await found(classes)).toEqual([finding]);
  });

  it.each([
    "rounded-control rounded-card rounded-badge rounded-pill rounded-t-sheet rounded-none",
    "text-display text-h1 text-h4 text-body text-sm text-caption text-text-muted text-left",
    "max-[359px]:text-caption max-[359px]:px-0",
    "active:scale-[0.97] grid-cols-[1fr_auto] z-[60] h-control-md min-h-row-song",
  ])("passes the tokens in %s", async (classes) => {
    expect(await found(classes)).toEqual([]);
  });

  it.each([
    ["-mt-3", "negative-margin -mt-3"],
    ["-mx-2", "negative-margin -mx-2"],
    ["-m-1", "negative-margin -m-1"],
    ["md:-ml-2.5", "negative-margin md:-ml-2.5"],
    ["-mb-px", "negative-margin -mb-px"],
  ])("lists the hand offset %s", async (classes, finding) => {
    expect(await found(classes)).toEqual([finding]);
  });

  it.each(["mt-3 mx-auto", "-translate-y-1/2 -z-10 -inset-x-2 -rotate-90"])("does not count %s as a negative margin", async (classes) => {
    expect(await found(classes)).toEqual([]);
  });

  it("leaves a primitive's own offset out, so the count is what callers still hand-tune", async () => {
    expect(await found("-ml-2.5", "src/components/ui/Fixture.tsx")).toEqual([]);
    expect(await found("-ml-2.5", "src/app/Fixture.tsx")).toEqual(["negative-margin -ml-2.5"]);
  });

  it("lists token literals inside ui, where raw controls are allowed", async () => {
    const code = 'export const X = () => <button className="h-11 rounded-xl" />;';
    expect((await inventoryOf(code, "src/components/ui/Fixture.tsx")).map((f) => f.category)).toEqual(["non-token"]);
    expect((await inventoryOf(code, "src/components/playlist/Fixture.tsx")).map((f) => `${f.category} ${f.detail}`)).toEqual([
      "raw-button h-11 rounded-xl",
      "non-token rounded-xl",
    ]);
  });

  it.each([
    ["raw-button", '// eslint-disable-next-line ds/no-raw-control\nexport const X = () => <button className="h-11 px-3" />;'],
    ["focus-ring", '// eslint-disable-next-line ds/focus-ring\nexport const c = "focus:outline-none";'],
    ["raw-input", '// eslint-disable-next-line ds/no-raw-input\nexport const X = () => <textarea rows={3} />;'],
    ["tracked-caps", '// eslint-disable-next-line ds/tracked-caps\nexport const c = "uppercase";'],
    ["inline-svg", '// eslint-disable-next-line ds/no-inline-svg\nexport const X = () => <svg aria-hidden />;'],
  ])("still lists a %s under an inline eslint-disable, so the comment cannot hide it", async (category, code) => {
    expect((await inventoryOf(code, "src/components/playlist/Fixture.tsx")).map((f) => f.category)).toEqual([category]);
  });

  it.each([
    ["src/components/setlist/BlockCards.tsx", "components/setlist"],
    ["src/app/guide/page.tsx", "app"],
    ["src/hooks/useQueue.ts", "hooks"],
  ])("groups %s under %s", (file, folder) => {
    expect(folderOf(file)).toBe(folder);
  });
});

describe("src", () => {
  // Lints the whole tree: under a second alone, but past vitest's 5s default on a 2-core CI runner while every other
  // file runs beside it (main a28824d, 2026-11-08).
  const WHOLE_TREE_LINT_MS = 60_000;

  it("has no raw control or text field, no outline removed without a focus ring, no tracked caps label and no icon drawn outside ui/icons, even under an inline eslint-disable", async () => {
    const lintRules = ["raw-button", "raw-link", "raw-input", "focus-ring", "tracked-caps", "inline-svg"];
    expect((await inventory()).filter((f) => lintRules.includes(f.category))).toEqual([]);
  }, WHOLE_TREE_LINT_MS);
});
