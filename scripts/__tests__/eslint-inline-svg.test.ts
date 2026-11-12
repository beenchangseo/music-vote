import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path d="M9 5l7 7-7 7" /></svg>';

async function inlineSvgErrors(code: string, file = "src/components/playlist/LintFixture.tsx") {
  const [result] = await eslint.lintText(`export const X = () => ${code};`, { filePath: `${cwd}/${file}` });
  return result.messages.filter((m) => m.ruleId === "ds/no-inline-svg").map((m) => m.message);
}

describe("eslint ds/no-inline-svg rule", () => {
  it.each([
    "src/components/playlist/LintFixture.tsx",
    "src/app/LintFixture.tsx",
    "src/components/ui/LintFixture.tsx",
    "src/app/api/playlist/[playlistId]/LintFixture/route.tsx",
  ])("flags an icon drawn inline in %s and sends it to ui/icons", async (file) => {
    const errors = await inlineSvgErrors(CHEVRON, file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("src/components/ui/icons.tsx");
  });

  it("flags every svg, not only the first", async () => {
    expect(await inlineSvgErrors(`<span>${CHEVRON}${CHEVRON}</span>`)).toHaveLength(2);
  });

  it.each(['React.createElement("svg", { "aria-hidden": true })', 'createElement("svg")', "createElement(`svg`, null)"])(
    "flags an svg built with %s",
    async (code) => {
      expect(await inlineSvgErrors(code)).toHaveLength(1);
    },
  );

  it.each(['<ChevronIcon direction="right" />', "<GuitarIcon className=\"size-5\" />", 'createElement("span")'])("allows %s", async (code) => {
    expect(await inlineSvgErrors(code)).toEqual([]);
  });

  it.each([
    ["the icon module itself", "src/components/ui/icons.tsx"],
    ["an OG image route, which Satori renders without the app's components", "src/app/api/og/route.tsx"],
    ["the setlist image route, also drawn by Satori", "src/app/api/setlist-image/[shareCode]/route.tsx"],
    ["Plypick's own logo lockup, a brand mark", "src/components/home/BrandMark.tsx"],
    ["test scaffolding", "src/components/playlist/__tests__/LintFixture.test.tsx"],
  ])("leaves %s alone", async (_what, file) => {
    expect(await inlineSvgErrors(CHEVRON, file)).toEqual([]);
  });
});
