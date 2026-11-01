import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function controlSizeErrors(code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/src/components/LintFixture.tsx` });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax").map((m) => m.message);
}

describe("eslint control-size rule", () => {
  it.each([
    '<Button size="sm" className="min-h-11 min-w-11" />',
    '<Button className="shrink-0 h-9" />',
    '<Button className="w-full" />',
    '<Button className="max-sm:px-0" />',
    '<Button className="rounded-pill" />',
    '<Button className="text-caption" />',
    '<IconButton aria-label="x" className="p-2" />',
    '<IconButton aria-label="x" className="size-9" />',
    '<Chip className="rounded" />',
    '<Chip className="py-1 text-xs" />',
    "<Button className={`${extra} !px-2`} />",
    '<Button className={wide ? "max-w-40" : undefined} />',
    '<Link href="/" className={buttonClassName({ variant: "tonal", className: "h-9" })} />',
  ])("flags %s", async (code) => {
    const errors = await controlSizeErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("size·variant prop");
  });

  it.each([
    '<Button className="mt-3 shrink-0 flex-1" />',
    '<Button className="hidden sm:inline-flex self-end order-last" />',
    '<IconButton aria-label="x" className="-mr-2 absolute right-2 top-2" />',
    '<Chip className="text-text-muted" />',
    "<Button className={`${extra} mx-auto`} />",
    '<button className="h-11 px-3 rounded-control text-sm" />',
    '<Badge className="max-w-18 truncate" />',
    '<Link href="/" className={buttonClassName({ variant: "tonal", className: "mt-4" })} />',
  ])("allows %s", async (code) => {
    expect(await controlSizeErrors(code)).toEqual([]);
  });
});
