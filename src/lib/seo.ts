// What search engines read about the site: the landing's title and description, each page's
// share card, and the schema.org graph the landing embeds. Facts here must stay true for the
// product (free: /about, Kakao login once: docs/adr/0009).

import type { Metadata } from "next";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-size";

export const SITE_URL = "https://plypick.kr";
export const SITE_NAME = "Plypick";

export const HOME_TITLE = "밴드 곡 투표로 합주곡·셋리스트 정하기 - Plypick";
export const HOME_DESCRIPTION =
  "단톡방에 흩어진 후보곡을 링크 하나에 모아 밴드 멤버들과 투표하고, 표 많이 받은 곡으로 공연 셋리스트까지 정해요. 무료, 카카오 로그인 한 번이면 시작해요.";

/** The /api/og card a page shares when it doesn't draw its own. */
export const DEFAULT_OG_IMAGE = {
  url: `/api/og?${new URLSearchParams({ title: SITE_NAME, subtitle: "밴드 합주곡, 투표로 정해요" })}`,
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  alt: "Plypick - 밴드 곡 투표 서비스",
};

/**
 * Open Graph fields every page shares. Next merges metadata shallowly: a page that sets
 * `openGraph` replaces the layout's whole object, so it spreads these back in.
 */
export const BASE_OPEN_GRAPH = {
  siteName: SITE_NAME,
  type: "website",
  locale: "ko_KR",
  images: [DEFAULT_OG_IMAGE],
} satisfies NonNullable<Metadata["openGraph"]>;

interface PageMetadataInput {
  /** Path under the site, e.g. "/guide". Also the canonical and og:url. */
  path: string;
  title: string;
  description: string;
  /** Shorter title for the share card. Defaults to `title`. */
  ogTitle?: string;
}

/** Metadata for a public page: its own canonical, and a share card that points at it, not at the home. */
export function pageMetadata({ path, title, description, ogTitle = title }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...BASE_OPEN_GRAPH, url: path, title: ogTitle, description },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * A screen of the app, captured from the real components with an invented band (no real accounts,
 * no YouTube thumbnails). The file is `public${src}`. Width and height are its pixel size.
 */
export interface ProductScreenshot {
  src: `/screenshots/${string}.webp`;
  width: number;
  height: number;
  alt: string;
}

export const PRODUCT_SCREENSHOTS = {
  candidates: {
    src: "/screenshots/candidates-vote.webp",
    width: 780,
    height: 1688,
    alt: "Plypick 후보곡 탭. 커버 아래 플레이리스트 제목과 곡 수·참여 인원·마감, 공유·재생 버튼이 있고, 밴드 멤버가 올린 후보곡이 점수 높은 순으로 순위, 찬성·반대 버튼, 점수와 함께 놓이며, 맨 아래에 밴드 홈·후보곡·셋리스트·합주 탭이 있는 화면",
  },
  setlist: {
    src: "/screenshots/setlist-runtime.webp",
    width: 780,
    height: 1688,
    alt: "Plypick 셋리스트 탭. 커버 옆에 6곡·총 공연 시간 27:20·인터벌 3이 있고, 곡 사이에 인사·멤버 소개와 튜닝 바꾸기 인터벌이 들어가 오른쪽 타임라인에 블록마다 시작 시각이 붙으며, 맨 아래에 밴드 홈·후보곡·셋리스트·합주 탭이 있는 화면",
  },
  bandHome: {
    src: "/screenshots/band-home.webp",
    width: 780,
    height: 1688,
    alt: "Plypick 밴드 홈. 왼쪽 위에 밴드를 바꾸는 버튼이 있고, 밴드 이름과 공연 D-13 아래에 '셋리스트 짜는 중' 배지가 붙은 지금 플레이리스트 카드와 밴드의 플레이리스트 선반, 맨 아래에 밴드 홈·플레이리스트·만들기 탭이 있는 화면",
  },
  setlistImage: {
    src: "/screenshots/setlist-export.webp",
    width: 720,
    height: 1280,
    alt: "Plypick에서 이미지로 저장한 셋리스트 예시. 세로 한 장에 곡 번호, 제목, 아티스트, BPM, 곡 길이와 멘트·튜닝 시간, 총 6곡 27:20이 정리된 모습",
  },
} as const satisfies Record<string, ProductScreenshot>;

const absoluteUrl = (path: string) => `${SITE_URL}${path}`;
const nodeId = (fragment: string) => `${SITE_URL}/#${fragment}`;

const imageObject = (shot: ProductScreenshot) => ({
  "@type": "ImageObject",
  url: absoluteUrl(shot.src),
  width: shot.width,
  height: shot.height,
  caption: shot.alt,
});

/**
 * The landing's structured data: who runs the site, the site, the web app itself, and the
 * landing's FAQ. `faq` and `screenshots` must be the lists the page shows: structured data that
 * the page doesn't show is against search engine guidelines.
 */
export function homeJsonLd(faq: readonly FaqEntry[], screenshots: readonly ProductScreenshot[]) {
  const organization = { "@id": nodeId("organization") };
  const [cover] = screenshots;
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
        ...(cover && { image: absoluteUrl(cover.src) }),
        screenshot: screenshots.map(imageObject),
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

/** A how-to page under /guide. `headline` is its H1, and `modified` is also its sitemap lastModified. */
export interface GuideArticle {
  path: `/guide/${string}`;
  title: string;
  headline: string;
  description: string;
  /** Calendar dates, YYYY-MM-DD. */
  published: string;
  modified: string;
}

export const GUIDE_ARTICLES = {
  setlist: {
    path: "/guide/setlist",
    title: "밴드 셋리스트 짜는 법: 순서·시간·양식 - Plypick",
    headline: "밴드 셋리스트 짜는 법",
    description:
      "공연 곡 순서를 정하고, 멘트·튜닝 시간까지 더해 무대 시간에 맞추고, 무대에 붙일 셋리스트 양식까지 만드는 방법을 정리했어요. 30분 무대 예시도 있어요.",
    published: "2026-11-08",
    modified: "2026-11-15",
  },
  chooseSongs: {
    path: "/guide/choose-songs",
    title: "합주곡·공연곡 정하는 법: 투표로 정하기 - Plypick",
    headline: "합주곡·공연곡, 투표로 정하는 법",
    description:
      "후보곡 고르는 기준부터 투표 방식, 마감, 동점일 때, 카톡 투표와 다른 점까지 밴드가 합주곡과 공연곡을 투표로 정하는 방법을 정리했어요.",
    published: "2026-11-08",
    modified: "2026-11-15",
  },
} as const satisfies Record<string, GuideArticle>;

/** Where a guide sits: the home, the usage guide, then the guide itself. The page shows the same trail. */
export function guideTrail(article: GuideArticle): { name: string; path: string }[] {
  return [
    { name: "홈", path: "/" },
    { name: "사용 가이드", path: "/guide" },
    { name: article.headline, path: article.path },
  ];
}

const PUBLISHER = { "@type": "Organization", "@id": nodeId("organization"), name: SITE_NAME, url: `${SITE_URL}/` };

/** A guide's structured data. `images` must be the screens the page shows, in page order. */
export function guideJsonLd(article: GuideArticle, images: readonly ProductScreenshot[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.headline,
        description: article.description,
        inLanguage: "ko-KR",
        datePublished: article.published,
        dateModified: article.modified,
        mainEntityOfPage: absoluteUrl(article.path),
        image: images.map((shot) => absoluteUrl(shot.src)),
        author: PUBLISHER,
        publisher: PUBLISHER,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: guideTrail(article).map((step, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: step.name,
          item: absoluteUrl(step.path),
        })),
      },
    ],
  };
}

/** Body of a `<script type="application/ld+json">`. `<` is escaped so no value can close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
