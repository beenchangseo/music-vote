import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBaseline, folderOf, inventoryOf, mainBaseline, ratchetProblems } from "../ds-inventory.mjs";

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

  it("still counts a raw control under an inline eslint-disable, so a disable comment cannot slip past the ratchet", async () => {
    const code = '// eslint-disable-next-line ds/no-raw-control\nexport const X = () => <button className="h-11 px-3" />;';
    expect((await inventoryOf(code, "src/components/playlist/Fixture.tsx")).map((f) => f.category)).toEqual(["raw-button"]);
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

  const file = "src/components/playlist/CommentModal.tsx";
  const allows = (count: number, rule = "ds/no-raw-control") => ({ [file]: { [rule]: { count } } });
  const kinds = (now: Record<string, number>, baseline: object, main: object | null) =>
    ratchetProblems(now, baseline, main).map((p: { kind: string }) => p.kind);

  it("fails a control added together with a hand-raised baseline, which only main's copy can see", () => {
    expect(kinds({ [file]: 6 }, allows(6), allows(5))).toEqual(["raised"]);
    expect(kinds({ [file]: 6 }, allows(6), null)).toEqual([]);
  });

  it("fails a file that main never allowed", () => {
    expect(kinds({ [file]: 1 }, allows(1), {})).toEqual(["raised"]);
  });

  it("passes a fix whose baseline was pruned, and asks for the prune until it is", () => {
    expect(kinds({ [file]: 4 }, allows(4), allows(5))).toEqual([]);
    expect(kinds({}, {}, allows(5))).toEqual([]);
    expect(kinds({ [file]: 4 }, allows(5), allows(5))).toEqual(["shrank"]);
  });

  it("fails a new control the baseline does not cover, and a foreign rule in the baseline", () => {
    expect(kinds({ [file]: 6 }, allows(5), allows(5))).toEqual(["grew"]);
    expect(kinds({}, allows(1, "no-restricted-syntax"), {})).toEqual(["foreign"]);
  });
});

describe("main's baseline", () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env, stdio: "ignore" });
  const commit = (cwd: string) => git(cwd, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "x");

  function repoWithMain(files: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), "ds-ratchet-"));
    git(dir, "init", "-q", "-b", "main");
    mkdirSync(join(dir, "src"));
    for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
    git(dir, "add", ".");
    commit(dir);
    git(dir, "update-ref", "refs/remotes/origin/main", "HEAD");
    return dir;
  }

  it("keys main's counts by today's paths when a file was renamed since the merge base", () => {
    const dir = repoWithMain({
      "src/A.tsx": "export const a = 'a long enough body for git to pair the rename';\n",
      "eslint-suppressions.json": JSON.stringify({ "src/A.tsx": { "ds/no-raw-control": { count: 2 } } }),
    });
    git(dir, "mv", "src/A.tsx", "src/B.tsx");
    commit(dir);
    expect(mainBaseline("origin/main", dir).baseline).toEqual({ "src/B.tsx": { "ds/no-raw-control": { count: 2 } } });
  });

  it("says why it skipped the comparison when main has no baseline or there is no main", () => {
    const dir = repoWithMain({ "src/A.tsx": "export {};\n" });
    expect(mainBaseline("origin/main", dir)).toMatchObject({ baseline: null, note: expect.stringContaining("eslint-suppressions.json 이 없어") });
    expect(mainBaseline("origin/no-such-branch", dir)).toMatchObject({ baseline: null, note: expect.stringContaining("찾지 못해") });
  });
});
