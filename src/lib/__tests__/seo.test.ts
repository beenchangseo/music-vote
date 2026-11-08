import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASE_OPEN_GRAPH,
  DEFAULT_OG_IMAGE,
  GUIDE_ARTICLES,
  HOME_DESCRIPTION,
  PRODUCT_SCREENSHOTS,
  guideJsonLd,
  homeJsonLd,
  jsonLdScript,
  pageMetadata,
  type ProductScreenshot,
} from "../seo";

const PUBLIC_DIR = join(__dirname, "..", "..", "..", "public");

/** Canvas size from a WebP header: the first chunk is VP8 (lossy), VP8L (lossless) or VP8X (extended). */
function webpSize(file: Buffer): { width: number; height: number } {
  expect(file.toString("ascii", 0, 4) + file.toString("ascii", 8, 12)).toBe("RIFFWEBP");
  const chunk = file.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + file.readUIntLE(24, 3), height: 1 + file.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = file.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  expect(chunk).toBe("VP8 ");
  return { width: file.readUInt16LE(26) & 0x3fff, height: file.readUInt16LE(28) & 0x3fff };
}

const SHOT_A: ProductScreenshot = { src: "/screenshots/a.webp", width: 780, height: 1688, alt: "후보곡 탭 화면" };
const SHOT_B: ProductScreenshot = { src: "/screenshots/b.webp", width: 720, height: 1280, alt: "셋리스트 이미지" };

describe("pageMetadata", () => {
  it("leaves og:url out of the shared fields, so a page never inherits the home's", () => {
    expect(BASE_OPEN_GRAPH).not.toHaveProperty("url");
  });

  it("points the share card at the page itself and keeps the site-wide fields", () => {
    const meta = pageMetadata({ path: "/guide", title: "셋리스트 정하는 방법 - Plypick", description: "설명" });

    expect(meta.alternates).toEqual({ canonical: "/guide" });
    expect(meta.openGraph).toMatchObject({
      url: "/guide",
      title: "셋리스트 정하는 방법 - Plypick",
      description: "설명",
      siteName: "Plypick",
      locale: "ko_KR",
      images: [DEFAULT_OG_IMAGE],
    });
    expect(meta.twitter).toMatchObject({ title: "셋리스트 정하는 방법 - Plypick", description: "설명" });
  });

  it("uses the short card title on the card only", () => {
    const meta = pageMetadata({ path: "/", title: "긴 검색 제목 - Plypick", description: "설명", ogTitle: "짧은 제목" });

    expect(meta.title).toBe("긴 검색 제목 - Plypick");
    expect(meta.openGraph?.title).toBe("짧은 제목");
    expect(meta.twitter?.title).toBe("짧은 제목");
  });
});

describe("PRODUCT_SCREENSHOTS", () => {
  it.each(Object.entries(PRODUCT_SCREENSHOTS))("%s is a WebP in public/ of the size it declares, under 200 KB", (_key, shot) => {
    const file = readFileSync(join(PUBLIC_DIR, shot.src));
    expect(file.byteLength).toBeLessThan(200 * 1024);
    expect(webpSize(file)).toEqual({ width: shot.width, height: shot.height });
    expect(shot.alt.trim()).not.toBe("");
  });
});

describe("homeJsonLd", () => {
  const faq = [{ question: "무료인가요?", answer: "네, 무료예요." }];
  const app = (shots: readonly ProductScreenshot[]) =>
    homeJsonLd(faq, shots)["@graph"].find((node) => node["@type"] === "WebApplication") as Record<string, unknown>;

  it("gives the web app the screens the landing shows, as absolute image URLs", () => {
    expect(app([SHOT_A, SHOT_B]).screenshot).toEqual([
      { "@type": "ImageObject", url: "https://plypick.kr/screenshots/a.webp", width: 780, height: 1688, caption: "후보곡 탭 화면" },
      { "@type": "ImageObject", url: "https://plypick.kr/screenshots/b.webp", width: 720, height: 1280, caption: "셋리스트 이미지" },
    ]);
    expect(app([SHOT_A, SHOT_B]).image).toBe("https://plypick.kr/screenshots/a.webp");
  });

  it("describes the organization, the site and a free web app, linked by id", () => {
    const graph = homeJsonLd(faq, [SHOT_A])["@graph"];
    const byType = Object.fromEntries(graph.map((node) => [node["@type"], node as Record<string, unknown>]));

    expect(Object.keys(byType).sort()).toEqual(["FAQPage", "Organization", "WebApplication", "WebSite"]);
    expect(byType.WebSite.publisher).toEqual({ "@id": byType.Organization["@id"] });
    expect(byType.WebApplication.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "KRW" });
    expect(byType.WebApplication.description).toBe(HOME_DESCRIPTION);
  });

  it("turns each FAQ entry into a question with its answer", () => {
    const faqPage = homeJsonLd(faq, [SHOT_A])["@graph"].find((node) => node["@type"] === "FAQPage") as Record<string, unknown>;

    expect(faqPage.mainEntity).toEqual([
      { "@type": "Question", name: "무료인가요?", acceptedAnswer: { "@type": "Answer", text: "네, 무료예요." } },
    ]);
  });
});

describe("guideJsonLd", () => {
  const article = {
    path: "/guide/test",
    title: "테스트 하는 법 - Plypick",
    headline: "테스트 하는 법",
    description: "설명",
    published: "2026-11-01",
    modified: "2026-11-08",
  } as const;
  const graph = guideJsonLd(article, [SHOT_B])["@graph"];
  const node = (type: string) => graph.find((entry) => entry["@type"] === type) as Record<string, unknown>;

  it("dates the article and credits the site, with the page as its main entity", () => {
    expect(node("Article")).toMatchObject({
      headline: "테스트 하는 법",
      description: "설명",
      inLanguage: "ko-KR",
      datePublished: "2026-11-01",
      dateModified: "2026-11-08",
      mainEntityOfPage: "https://plypick.kr/guide/test",
      image: ["https://plypick.kr/screenshots/b.webp"],
      author: { "@type": "Organization", name: "Plypick", url: "https://plypick.kr/" },
      publisher: { "@type": "Organization", name: "Plypick", url: "https://plypick.kr/" },
    });
  });

  it("places the article under the home and the usage guide", () => {
    expect(node("BreadcrumbList").itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "홈", item: "https://plypick.kr/" },
      { "@type": "ListItem", position: 2, name: "사용 가이드", item: "https://plypick.kr/guide" },
      { "@type": "ListItem", position: 3, name: "테스트 하는 법", item: "https://plypick.kr/guide/test" },
    ]);
  });
});

describe("GUIDE_ARTICLES", () => {
  it.each(Object.entries(GUIDE_ARTICLES))("%s sits under /guide/ with calendar dates, changed no earlier than written", (_key, article) => {
    expect(article.path).toMatch(/^\/guide\/[a-z-]+$/);
    for (const date of [article.published, article.modified]) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
    }
    expect(article.modified >= article.published).toBe(true);
  });
});

describe("jsonLdScript", () => {
  it("escapes < so a value cannot close the script tag", () => {
    const body = jsonLdScript({ name: "</script><script>alert(1)</script>" });

    expect(body).not.toContain("<");
    expect(JSON.parse(body)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
