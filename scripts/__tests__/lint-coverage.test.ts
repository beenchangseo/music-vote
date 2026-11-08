import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("npm run lint", () => {
  // The eslint CLI reads this file from the repo root on its own and passes every error it lists, whatever the rule:
  // one entry for no-restricted-syntax lets a postgres_changes subscription through, which breaks anonymous mode.
  it("has no eslint-suppressions.json to read, so no rule's errors are waved through", () => {
    expect(existsSync(`${root}eslint-suppressions.json`)).toBe(false);
  });

  // --suppressions-location points the CLI at a suppressions file anywhere else, past the check above.
  it("runs eslint without pointing it at a suppressions file elsewhere", () => {
    const { scripts } = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as { scripts: Record<string, string> };
    expect(Object.values(scripts).filter((script) => script.includes("suppressions-location"))).toEqual([]);
  });

  // Every rule on src in eslint.config.mjs, and the ds inventory, reads .ts and .tsx only. tsconfig's allowJs would still
  // build a .js·.jsx·.mjs file there, past every one of them.
  it("sees every script in src, because src holds only .ts and .tsx scripts", () => {
    const scripts = readdirSync(`${root}src`, { recursive: true, encoding: "utf8" }).filter((file) => /\.[cm]?[jt]sx?$/.test(file));
    expect(scripts.filter((file) => !/\.tsx?$/.test(file))).toEqual([]);
    expect(scripts.length).toBeGreaterThan(0);
  });
});
