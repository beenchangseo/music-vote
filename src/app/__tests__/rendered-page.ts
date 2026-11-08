import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { SITE_URL } from "@/lib/seo";

const PUBLIC_DIR = join(__dirname, "..", "..", "..", "public");

/** The file each rendered <img> shows. next/image points src at its optimizer, which names the file in `url`. */
export function shownImages(root: ParentNode = document): { path: string; alt: string }[] {
  return [...root.querySelectorAll("img")].map((img) => {
    const src = new URL(img.getAttribute("src") ?? "", SITE_URL);
    return { path: src.searchParams.get("url") ?? src.pathname, alt: img.getAttribute("alt") ?? "" };
  });
}

/** The page's JSON-LD graph nodes, parsed from every ld+json script it renders. */
export function jsonLdNodes(root: ParentNode = document): Record<string, unknown>[] {
  return [...root.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
    const data = JSON.parse(script.textContent ?? "");
    return data["@graph"] ?? [data];
  });
}

/** An absolute plypick.kr URL as the site path it names, checked to be a file under public/. */
export function publicFileOf(url: string): string {
  expect(url.startsWith(`${SITE_URL}/`), url).toBe(true);
  const path = url.slice(SITE_URL.length);
  expect(existsSync(join(PUBLIC_DIR, path)), `${path} in public/`).toBe(true);
  return path;
}

export const linkTargets = (root: ParentNode = document) =>
  [...root.querySelectorAll("a[href]")].map((link) => link.getAttribute("href"));
