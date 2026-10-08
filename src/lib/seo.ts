// What search engines read about the site: the landing's title and description, and the
// schema.org graph the landing embeds. Facts here must stay true for the product
// (free: /about, Kakao login once: docs/adr/0009).

export const SITE_URL = "https://plypick.kr";
export const SITE_NAME = "Plypick";

export const HOME_TITLE = "밴드 곡 투표로 합주곡·셋리스트 정하기 - Plypick";
export const HOME_DESCRIPTION =
  "단톡방에 흩어진 후보곡을 링크 하나에 모아 밴드 멤버들과 투표하고, 표 많이 받은 곡으로 공연 셋리스트까지 정해요. 무료, 카카오 로그인 한 번이면 시작해요.";

export interface FaqEntry {
  question: string;
  answer: string;
}

const nodeId = (fragment: string) => `${SITE_URL}/#${fragment}`;

/**
 * The landing's structured data: who runs the site, the site, the web app itself, and the
 * landing's FAQ. `faq` must be the same list the page shows — structured data that the page
 * doesn't show is against search engine guidelines.
 */
export function homeJsonLd(faq: readonly FaqEntry[]) {
  const organization = { "@id": nodeId("organization") };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": nodeId("organization"),
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": nodeId("website"),
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: "ko-KR",
        publisher: organization,
      },
      {
        "@type": "WebApplication",
        "@id": nodeId("app"),
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: HOME_DESCRIPTION,
        inLanguage: "ko-KR",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
        publisher: organization,
      },
      {
        "@type": "FAQPage",
        "@id": nodeId("faq"),
        inLanguage: "ko-KR",
        mainEntity: faq.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: { "@type": "Answer", text: entry.answer },
        })),
      },
    ],
  };
}

/** Body of a `<script type="application/ld+json">`. `<` is escaped so no value can close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
