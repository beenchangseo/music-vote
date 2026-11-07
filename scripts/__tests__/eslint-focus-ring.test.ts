import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function focusRingErrors(code: string, file = "src/components/LintFixture.tsx") {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/${file}` });
  return result.messages.filter((m) => m.ruleId === "ds/focus-ring").map((m) => m.message);
}

describe("eslint ds/focus-ring rule", () => {
  it.each([
    ['<input className="h-11 focus:outline-none focus:border-primary-fg" />', "focus:outline-none"],
    ['<button className="focus-visible:outline-none ring-2 ring-focus-ring" />', "focus-visible:outline-none"],
    ['<div tabIndex={0} className="outline-hidden" />', "outline-hidden"],
    ["const skin = `w-full focus:outline-0 ${tone}`;", "focus:outline-0"],
  ])("flags %s", async (code, token) => {
    const errors = await focusRingErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`${token} 은`);
  });

  it.each([
    '<input className="focus:outline-none focus:ring-2 focus:ring-focus-ring" />',
    '<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2" />',
    "const skin = `w-full focus:outline-none focus:ring-[3px] ${tone}`;",
    '<div className="outline-1 outline-dashed outline-border" />',
    '<button className="h-11" />',
  ])("allows %s", async (code) => {
    expect(await focusRingErrors(code)).toEqual([]);
  });

  it("covers ui primitives too", async () => {
    expect(await focusRingErrors('<input className="focus:outline-none" />', "src/components/ui/LintFixture.tsx")).toHaveLength(1);
  });
});
