import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function colorRoleErrors(code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/src/components/LintFixture.tsx` });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax").map((m) => m.message);
}

describe("eslint color-role rule", () => {
  it.each([
    ['<p className="text-primary" />', "text-primary-fg"],
    ['<p className="hover:text-primary underline" />', "text-primary-fg"],
    ['<p className="text-primary/70" />', "text-primary-fg"],
    ['<p className="hover:text-primary-hover" />', "text-primary-fg"],
    ["const c = `x ${on ? 1 : 0} text-primary`;", "text-primary-fg"],
    ['<p className="text-danger" />', "text-danger-fg"],
    ['<div className="bg-primary-soft" />', "primary-tint"],
    ["const c = `from-primary-soft/60 ${x}`;", "primary-tint"],
  ])("flags %s", async (code, hint) => {
    const errors = await colorRoleErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(hint);
  });

  it.each([
    '<p className="text-primary-fg hover:text-on-primary-tint" />',
    '<button className="bg-primary text-on-primary hover:bg-primary-hover border-primary" />',
    '<p className="bg-primary-tint text-on-primary-tint" />',
    '<p className="text-danger-fg bg-danger" />',
    "const c = `ring-focus-ring ${x} text-primary-fg`;",
  ])("allows %s", async (code) => {
    expect(await colorRoleErrors(code)).toEqual([]);
  });
});
