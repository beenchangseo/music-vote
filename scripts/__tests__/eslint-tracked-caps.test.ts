import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function trackedCapsErrors(code: string, file = "src/components/LintFixture.tsx") {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/${file}` });
  return result.messages.filter((m) => m.ruleId === "ds/tracked-caps").map((m) => m.message);
}

// Korean has no letter case, so uppercase with wide tracking only spreads the syllables apart: the label reads as an
// English template. Seven settings-sheet labels shipped that way.
describe("eslint ds/tracked-caps rule", () => {
  it.each([
    ['<p className="text-caption font-semibold uppercase text-text-subtle">밴드</p>', "uppercase"],
    ['<p className="text-caption tracking-wider">옵션</p>', "tracking-wider"],
    ['<p className="tracking-wide" />', "tracking-wide"],
    ['<p className="text-caption font-bold tracking-widest">셋리스트</p>', "tracking-widest"],
    ['<p className="sm:uppercase" />', "sm:uppercase"],
    ["const label = `text-caption ${tone} hover:tracking-widest`;", "hover:tracking-widest"],
    ['const style = { textTransform: "uppercase" };', "uppercase"],
  ])("flags %s", async (code, token) => {
    const errors = await trackedCapsErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`${token} 은`);
  });

  it("flags each token of a label that has both", async () => {
    expect(await trackedCapsErrors('<p className="uppercase tracking-wider">투표 초기화</p>')).toHaveLength(2);
  });

  it.each([
    '<p className="text-caption font-semibold text-text-subtle">투표 · 공개 범위</p>',
    '<p className="normal-case tracking-normal" />',
    '<h1 className="text-display font-bold tracking-tight" />',
    'const note = "tracking-widened uppercased";',
  ])("allows %s", async (code) => {
    expect(await trackedCapsErrors(code)).toEqual([]);
  });

  it("leaves the ui primitives to their own type", async () => {
    expect(await trackedCapsErrors('<p className="uppercase tracking-wider" />', "src/components/ui/LintFixture.tsx")).toEqual([]);
  });
});
