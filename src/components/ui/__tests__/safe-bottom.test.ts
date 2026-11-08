import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../../..", import.meta.url));

interface JsxTag {
  tag: string;
  at: string;
  attrs: Map<string, string>;
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/** Every JSX opening tag in `file`, with each attribute's source text (a bare attribute is ""). */
function jsxTags(file: string): JsxTag[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tags: JsxTag[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = new Map<string, string>();
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop)) attrs.set(prop.name.getText(source), prop.initializer?.getText(source) ?? "");
      }
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      tags.push({ tag: node.tagName.getText(source), at: `${relative(src, file)}:${line}`, attrs });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return tags;
}

/** True when the class source text carries `utility` unconditionally (no variant prefix). */
const hasUtility = (classes: string | undefined, utility: string) =>
  new RegExp(`(^|[\\s"'\`{])${utility.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&")}($|[\\s"'\`}])`).test(classes ?? "");

const tags = tsxFiles(src).flatMap(jsxTags);

describe("bottom safe area", () => {
  const body = tags.filter((t) => t.tag === "body" && t.at.startsWith("app/layout.tsx:"));

  it("pads the inset on the root layout's body and hands it to a bar that paints it itself", () => {
    expect(body).toHaveLength(1);
    for (const utility of ["pb-safe-bottom", "has-data-safe-bottom:pb-0"]) {
      expect(hasUtility(body[0].attrs.get("className"), utility), utility).toBe(true);
    }
  });

  const bars = tags.filter((t) => t.attrs.has("data-safe-bottom"));

  it("finds the bars that opt out of the body padding", () => {
    expect(bars.length).toBeGreaterThan(0);
  });

  // The body drops its padding once a data-safe-bottom bar is on screen, so a bar that does not take the
  // padding itself leaves the home indicator over its buttons.
  it.each(bars.map((t) => [t.at, t]))("%s takes pb-safe-bottom with data-safe-bottom", (_at, bar) => {
    expect(hasUtility(bar.attrs.get("className"), "pb-safe-bottom")).toBe(true);
  });
});
