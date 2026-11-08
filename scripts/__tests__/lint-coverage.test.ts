import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("npm run lint", () => {
  // The eslint CLI reads this file from the repo root on its own and passes every error it lists, whatever the rule:
  // one entry for no-restricted-syntax lets a postgres_changes subscription through, which breaks anonymous mode.
  it("has no eslint-suppressions.json to read, so no rule's errors are waved through", () => {
    expect(existsSync(`${root}eslint-suppressions.json`)).toBe(false);
  });
});
