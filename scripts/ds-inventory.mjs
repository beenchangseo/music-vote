#!/usr/bin/env node
//   node scripts/ds-inventory.mjs                   디자인 시스템을 비껴 간 곳을 파일·줄마다 보여 준다
//   node scripts/ds-inventory.mjs --json            같은 내용을 JSON 으로
//   node scripts/ds-inventory.mjs --check-baseline  ds/no-raw-control 이 eslint-suppressions.json 과 다르면 1 로 끝난다
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint } from "eslint";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RATCHET_RULE = "ds/no-raw-control";
const BASELINE = "eslint-suppressions.json";

const CATEGORIES = {
  "raw-button": "ui 밖에서 크기·모서리·글자 크기를 직접 칠한 <button>",
  "raw-link": "buttonClassName() 없이 버튼처럼 칠한 <a>·<Link>",
  "non-token": "토큰이 아닌 모서리·글자 크기 (rounded-xl·text-lg 등)",
  arbitrary: "크기·여백·위치의 임의 값 [..]",
};

function categoryOf(message) {
  if (message.ruleId === RATCHET_RULE) return message.messageId === "rawLink" ? "raw-link" : "raw-button";
  return message.ruleId.slice("ds/".length);
}

/** src/components/<screen> keeps its screen; everything else groups by its top folder (app, lib, hooks). */
export function folderOf(file) {
  const parts = file.split("/");
  return parts[1] === "components" ? parts.slice(1, 3).join("/") : parts[1];
}

// eslint.config.mjs registers the ds plugin and decides where ds/no-raw-control applies.
// The inventory-only rules cover all of src, ui included.
const engine = () =>
  new ESLint({
    cwd: root,
    overrideConfig: {
      files: ["src/**/*.{ts,tsx}"],
      ignores: ["src/**/__tests__/**"],
      rules: { "ds/non-token": "warn", "ds/arbitrary": "warn" },
    },
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
          detail: m.ruleId === RATCHET_RULE ? (m.message.match(/className="([^"]*)"/)?.[1] ?? "") : m.message,
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

/**
 * The ratchet: every file's ds/no-raw-control count must equal its entry in eslint-suppressions.json.
 * More means a new hand-drawn control; fewer means the baseline should shrink to lock the gain in.
 */
export async function checkBaseline() {
  const path = join(root, BASELINE);
  const baseline = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const findings = (await inventory()).filter((f) => f.category === "raw-button" || f.category === "raw-link");

  const now = {};
  for (const f of findings) now[f.file] = (now[f.file] ?? 0) + 1;

  const problems = [];
  for (const [file, rules] of Object.entries(baseline)) {
    for (const rule of Object.keys(rules)) if (rule !== RATCHET_RULE) problems.push({ kind: "foreign", file, rule });
  }
  for (const file of new Set([...Object.keys(now), ...Object.keys(baseline)])) {
    const count = now[file] ?? 0;
    const allowed = baseline[file]?.[RATCHET_RULE]?.count ?? 0;
    if (count > allowed) problems.push({ kind: "grew", file, count, allowed, lines: findings.filter((f) => f.file === file).map((f) => f.line) });
    if (count < allowed) problems.push({ kind: "shrank", file, count, allowed });
  }

  const lines = problems.map((p) => {
    if (p.kind === "foreign") return `- ${p.file}: ${p.rule} 가 ${BASELINE} 에 있다. 이 파일은 DS 래칫(${RATCHET_RULE}) 전용이다. 규칙 위반은 고친다.`;
    if (p.kind === "grew")
      return (
        `- ${p.file}: 손으로 그린 컨트롤이 ${p.allowed}개에서 ${p.count}개로 늘었다(줄 ${p.lines.join(", ")}). ` +
        `src/components/ui 의 Button·IconButton·Chip·ListRowButton·ToolbarButton, 링크는 buttonClassName() 으로 그린다. ${BASELINE} 은 늘리지 않는다.`
      );
    return `- ${p.file}: ${p.allowed}개에서 ${p.count}개로 줄었다. npx eslint --prune-suppressions 로 ${BASELINE} 을 줄여 같이 커밋한다.`;
  });
  return { problems, text: lines.length ? `DS 래칫이 baseline 과 맞지 않는다.\n${lines.join("\n")}` : "DS 래칫이 baseline 과 같다." };
}

function printTable(findings) {
  const width = Math.max(...findings.map((f) => `${f.file}:${f.line}`.length), 0);
  for (const f of findings) console.log(`${f.category.padEnd(10)}  ${`${f.file}:${f.line}`.padEnd(width)}  ${f.detail}`);

  const { byCategory, byFolder } = summarize(findings);
  console.log("\n분류별");
  for (const [c, n] of Object.entries(byCategory)) console.log(`  ${String(n).padStart(4)}  ${c.padEnd(10)}  ${CATEGORIES[c]}`);

  const cols = Object.keys(CATEGORIES);
  console.log(`\n폴더별\n  ${"folder".padEnd(22)}${cols.map((c) => c.padStart(11)).join("")}${"total".padStart(8)}`);
  for (const [folder, counts] of Object.entries(byFolder).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${folder.padEnd(22)}${cols.map((c) => String(counts[c]).padStart(11)).join("")}${String(counts.total).padStart(8)}`);
  }
}

async function main() {
  if (process.argv.includes("--check-baseline")) {
    const { problems, text } = await checkBaseline();
    console.log(text);
    process.exit(problems.length ? 1 : 0);
  }
  const findings = await inventory();
  if (process.argv.includes("--json")) console.log(JSON.stringify({ findings, ...summarize(findings) }, null, 2));
  else printTable(findings);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
