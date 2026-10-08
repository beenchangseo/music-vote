import { describe, expect, it } from "vitest";
import { HOME_DESCRIPTION, homeJsonLd, jsonLdScript } from "../seo";

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
