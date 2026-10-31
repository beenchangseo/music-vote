#!/usr/bin/env node
//   node scripts/codemods/ds1-color-roles.mjs          고친다
//   node scripts/codemods/ds1-color-roles.mjs --check  고칠 곳이 있으면 1 로 끝난다
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const RULES = [
  { from: "text-primary", to: "text-primary-fg", dropOpacity: true },
  { from: "text-primary-hover", to: "text-on-primary-tint" },
  { from: "border-t-primary", to: "border-t-primary-fg" },
  { from: "fill-primary", to: "fill-primary-fg" },
  { from: "stroke-primary", to: "stroke-primary-fg" },
  { from: "ring-primary", to: "ring-focus-ring" },
  { from: "border-primary", to: "border-focus-ring", onlyAfter: /(^|:)focus(-visible)?:$/ },
  { from: "bg-primary-soft", to: "bg-primary-tint" },
  { from: "from-primary-soft", to: "from-primary-tint" },
  { from: "to-primary-soft", to: "to-primary-tint" },
  { from: "text-danger", to: "text-danger-fg", dropOpacity: true },
  { from: "text-red-400", to: "text-danger-fg" },
];

const VARIANT_RENAMES = { secondary: "tonal" };

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = RULES.map((rule) => ({
  rule,
  re: new RegExp(`^(.*:)?(!?)${escape(rule.from)}(/\\d+)?(!?)$`),
}));

export function rewriteClassText(text) {
  const hits = [];
  const out = text.replace(/[^\s"'`${}]+/g, (token) => {
    for (const { rule, re } of MATCHERS) {
      const m = token.match(re);
      if (!m) continue;
      const [, prefix = "", lead, opacity = "", trail] = m;
      if (rule.onlyAfter && !rule.onlyAfter.test(prefix)) continue;
      hits.push(`${rule.from} → ${rule.to}`);
      return `${prefix}${lead}${rule.to}${rule.dropOpacity ? "" : opacity}${trail}`;
    }
    return token;
  });
  return { text: out, hits };
}

function isVariantValue(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p) || ts.isPropertyAssignment(p)) return p.name.getText() === "variant";
    if (!(ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p) || ts.isJsxExpression(p) || ts.isBinaryExpression(p))) {
      return false;
    }
  }
  return false;
}

export function rewriteSource(source, fileName = "file.tsx") {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const hits = [];

  const visit = (node) => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail;
    if (isText) {
      const start = node.getStart(sf);
      const raw = source.slice(start, node.end);
      if (ts.isStringLiteral(node) && VARIANT_RENAMES[node.text] && isVariantValue(node)) {
        const to = VARIANT_RENAMES[node.text];
        edits.push({ start, end: node.end, text: raw.replace(node.text, to) });
        hits.push(`variant ${node.text} → ${to}`);
      } else {
        const r = rewriteClassText(raw);
        if (r.hits.length) {
          edits.push({ start, end: node.end, text: r.text });
          hits.push(...r.hits);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  let output = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, e.start) + e.text + output.slice(e.end);
  }
  return { output, hits };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const check = process.argv.includes("--check");
  const files = readdirSync(join(root, "src"), { recursive: true })
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => join(root, "src", f));

  const total = new Map();
  let changed = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const { output, hits } = rewriteSource(source, file);
    if (!hits.length) continue;
    changed++;
    for (const h of hits) total.set(h, (total.get(h) ?? 0) + 1);
    console.log(`${relative(root, file)}  ${hits.length}`);
    if (!check) writeFileSync(file, output);
  }

  console.log(`\n${changed} files, ${[...total.values()].reduce((a, b) => a + b, 0)} rewrites`);
  for (const [rule, n] of [...total].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${rule}`);
  if (check && changed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
