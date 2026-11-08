#!/usr/bin/env node
//   node scripts/ds-inventory.mjs         디자인 시스템을 비껴 간 곳을 파일·줄마다 보여 준다
//   node scripts/ds-inventory.mjs --json  같은 내용을 JSON 으로
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint } from "eslint";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_CONTROL_RULE = "ds/no-raw-control";
const RAW_INPUT_RULE = "ds/no-raw-input";

const CATEGORIES = {
  "raw-button": "ui 밖에서 크기·모서리·글자 크기를 직접 칠한 <button>",
  "raw-link": "ui 밖에서 바탕·테두리와 크기를 직접 칠한 <a>·<Link>",
  "raw-input": "ui 밖에서 직접 그린 텍스트 <input>·<textarea>",
  "non-token": "토큰이 아닌 모서리·글자 크기 (rounded-xl·text-lg 등)",
  arbitrary: "크기·여백·위치의 임의 값 [..]",
  "negative-margin": "ui 밖의 음수 margin (-mt-3·-mx-2 등). 칸을 레이아웃 밖으로 당기는 손 보정",
  "focus-ring": "포커스 ring 없이 outline 을 지운 클래스",
};

function categoryOf(message) {
  if (message.ruleId === RAW_CONTROL_RULE) return message.messageId === "rawLink" ? "raw-link" : "raw-button";
  if (message.ruleId === RAW_INPUT_RULE) return "raw-input";
  return message.ruleId.slice("ds/".length);
}

function detailOf(message) {
  if (message.ruleId === RAW_CONTROL_RULE) return message.message.match(/className="([^"]*)"/)?.[1] ?? "";
  if (message.ruleId === RAW_INPUT_RULE) return message.message.match(/^<[^>]*>/)?.[0] ?? "";
  return message.message;
}

/** src/components/<screen> keeps its screen; everything else groups by its top folder (app, lib, hooks). */
export function folderOf(file) {
  const parts = file.split("/");
  return parts[1] === "components" ? parts.slice(1, 3).join("/") : parts[1];
}

// eslint.config.mjs registers the ds plugin and decides where ds/no-raw-control and ds/no-raw-input apply.
// non-token and arbitrary cover all of src, ui included. Negative margins skip ui: a primitive that lines a glyph up
// with the content edge (RoundLink edge="start") owns that offset once, so its callers need none.
const engine = () =>
  new ESLint({
    cwd: root,
    overrideConfig: [
      {
        files: ["src/**/*.{ts,tsx}"],
        ignores: ["src/**/__tests__/**"],
        rules: { "ds/non-token": "warn", "ds/arbitrary": "warn" },
        // An eslint-disable comment hides a raw control from lint; the inventory still lists it.
        linterOptions: { noInlineConfig: true },
      },
      {
        files: ["src/**/*.{ts,tsx}"],
        ignores: ["src/**/__tests__/**", "src/components/ui/**"],
        rules: { "ds/negative-margin": "warn" },
      },
    ],
    ruleFilter: ({ ruleId }) => ruleId.startsWith("ds/"),
  });

/** @typedef {{ category: keyof typeof CATEGORIES, file: string, line: number, detail: string }} Finding */

/** @returns {Promise<Finding[]>} */
export async function inventory() {
  return toFindings(await engine().lintFiles(["src"]));
}

/** The findings for one source text as if it lived at `file` (relative to the repo root). */
export async function inventoryOf(code, file) {
  return toFindings(await engine().lintText(code, { filePath: join(root, file) }));
}

/** @returns {Finding[]} */
function toFindings(results) {
  return results
    .flatMap((result) =>
      result.messages
        .filter((m) => m.ruleId?.startsWith("ds/"))
        .map((m) => ({
          category: categoryOf(m),
          file: relative(root, result.filePath),
          line: m.line,
          detail: detailOf(m),
        })),
    )
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function summarize(findings) {
  const zeros = () => Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, 0]));
  const byCategory = zeros();
  const byFolder = {};
  for (const f of findings) {
    byCategory[f.category]++;
    const folder = (byFolder[folderOf(f.file)] ??= { ...zeros(), total: 0 });
    folder[f.category]++;
    folder.total++;
  }
  return { byCategory, byFolder };
}

function printTable(findings) {
  const cols = Object.keys(CATEGORIES);
  const catWidth = Math.max(...cols.map((c) => c.length));
  const width = Math.max(...findings.map((f) => `${f.file}:${f.line}`.length), 0);
  for (const f of findings) console.log(`${f.category.padEnd(catWidth)}  ${`${f.file}:${f.line}`.padEnd(width)}  ${f.detail}`);

  const { byCategory, byFolder } = summarize(findings);
  console.log("\n분류별");
  for (const [c, n] of Object.entries(byCategory)) console.log(`  ${String(n).padStart(4)}  ${c.padEnd(catWidth)}  ${CATEGORIES[c]}`);

  const col = (c) => Math.max(11, c.length + 2);
  console.log(`\n폴더별\n  ${"folder".padEnd(22)}${cols.map((c) => c.padStart(col(c))).join("")}${"total".padStart(8)}`);
  for (const [folder, counts] of Object.entries(byFolder).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${folder.padEnd(22)}${cols.map((c) => String(counts[c]).padStart(col(c))).join("")}${String(counts.total).padStart(8)}`);
  }
}

async function main() {
  const findings = await inventory();
  if (process.argv.includes("--json")) console.log(JSON.stringify({ findings, ...summarize(findings) }, null, 2));
  else printTable(findings);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
