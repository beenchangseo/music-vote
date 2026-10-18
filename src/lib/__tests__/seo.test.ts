import { describe, expect, it } from "vitest";
import { BASE_OPEN_GRAPH, DEFAULT_OG_IMAGE, HOME_DESCRIPTION, homeJsonLd, jsonLdScript, pageMetadata } from "../seo";

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

describe("homeJsonLd", () => {
  const faq = [{ question: "무료인가요?", answer: "네, 무료예요." }];

  it("describes the organization, the site and a free web app, linked by id", () => {
    const graph = homeJsonLd(faq)["@graph"];
    const byType = Object.fromEntries(graph.map((node) => [node["@type"], node as Record<string, unknown>]));

    expect(Object.keys(byType).sort()).toEqual(["FAQPage", "Organization", "WebApplication", "WebSite"]);
    expect(byType.WebSite.publisher).toEqual({ "@id": byType.Organization["@id"] });
    expect(byType.WebApplication.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "KRW" });
    expect(byType.WebApplication.description).toBe(HOME_DESCRIPTION);
  });

  it("turns each FAQ entry into a question with its answer", () => {
    const faqPage = homeJsonLd(faq)["@graph"].find((node) => node["@type"] === "FAQPage") as Record<string, unknown>;

    expect(faqPage.mainEntity).toEqual([
      { "@type": "Question", name: "무료인가요?", acceptedAnswer: { "@type": "Answer", text: "네, 무료예요." } },
    ]);
  });
});

describe("jsonLdScript", () => {
  it("escapes < so a value cannot close the script tag", () => {
    const body = jsonLdScript({ name: "</script><script>alert(1)</script>" });

    expect(body).not.toContain("<");
    expect(JSON.parse(body)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
