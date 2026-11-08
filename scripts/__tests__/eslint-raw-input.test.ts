import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function rawInputErrors(code: string, file = "src/components/LintFixture.tsx") {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/${file}` });
  return result.messages.filter((m) => m.ruleId === "ds/no-raw-input").map((m) => m.message);
}

describe("eslint ds/no-raw-input rule", () => {
  it.each([
    ['<input className="h-11 rounded-control px-4" />', "<input>"],
    ['<input type="text" value={v} onChange={f} />', '<input type="text">'],
    ['<input type="number" min={0} />', '<input type="number">'],
    ['<input type="Search" {...rest} />', '<input type="search">'],
    ['<input type={secret ? "password" : "text"} />', '<input type="password|text">'],
    ['<input type={on ? "checkbox" : "text"} />', '<input type="checkbox|text">'],
    ["<input type={kind} />", '<input type="…">'],
    ["<textarea rows={3} />", "<textarea>"],
  ])("flags %s", async (code, shown) => {
    const errors = await rawInputErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`${shown} 를 직접 그리지 않는다`);
    expect(errors[0]).toContain("Input·Textarea");
  });

  it.each([
    '<input type="checkbox" checked={on} onChange={f} />',
    '<input type="radio" name="mode" />',
    '<input type="range" min={0} max={100} />',
    '<input type="hidden" name="code" value={code} />',
    '<input type="file" accept="image/*" />',
    '<input type={multi ? "checkbox" : "radio"} />',
    '<Input type="text" />',
    "<Textarea rows={3} />",
  ])("allows %s", async (code) => {
    expect(await rawInputErrors(code)).toEqual([]);
  });

  it.each(["src/components/ui/LintFixture.tsx", "src/components/playlist/__tests__/LintFixture.test.tsx"])(
    "leaves %s alone, where Input itself and test scaffolding live",
    async (file) => {
      expect(await rawInputErrors('<input type="text" />', file)).toEqual([]);
    },
  );
});
