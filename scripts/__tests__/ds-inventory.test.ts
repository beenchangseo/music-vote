import { describe, expect, it } from "vitest";
import { checkBaseline, folderOf, inventoryOf } from "../ds-inventory.mjs";

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

  it("lists token literals inside ui, where raw controls are allowed", async () => {
    const code = 'export const X = () => <button className="h-11 rounded-xl" />;';
    expect((await inventoryOf(code, "src/components/ui/Fixture.tsx")).map((f) => f.category)).toEqual(["non-token"]);
    expect((await inventoryOf(code, "src/components/playlist/Fixture.tsx")).map((f) => `${f.category} ${f.detail}`)).toEqual([
      "raw-button h-11 rounded-xl",
      "non-token rounded-xl",
    ]);
  });

  it.each([
    ["src/components/setlist/BlockCards.tsx", "components/setlist"],
    ["src/app/guide/page.tsx", "app"],
    ["src/hooks/useQueue.ts", "hooks"],
  ])("groups %s under %s", (file, folder) => {
    expect(folderOf(file)).toBe(folder);
  });
});

describe("DS ratchet", () => {
  it("matches eslint-suppressions.json: no new hand-drawn controls, and fixed ones leave the baseline", async () => {
    const { problems, text } = await checkBaseline();
    expect(problems, text).toEqual([]);
  });
});
