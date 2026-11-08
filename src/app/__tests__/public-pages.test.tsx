// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Metadata } from "next";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/seo";
import AboutPage, { metadata as aboutMetadata } from "../about/page";
import GuidePage, { metadata as guideMetadata } from "../guide/page";
import SetlistGuidePage, { metadata as setlistGuideMetadata } from "../guide/setlist/page";
import ChooseSongsGuidePage, { metadata as chooseSongsGuideMetadata } from "../guide/choose-songs/page";
import { metadata as privacyMetadata } from "../privacy/page";
import { metadata as termsMetadata } from "../terms/page";
import { metadata as supportMetadata } from "../support/page";
import sitemap from "../sitemap";
import { jsonLdNodes, linkTargets, publicFileOf, shownImages } from "./rendered-page";

afterEach(cleanup);

interface PublicPage {
  path: string;
  Page: ComponentType;
  metadata: Metadata;
  title: string;
  h1: string;
  description: string;
  /** Pages this one must link to, so search engines reach them from here. */
  linksTo: string[];
}

const PAGES: PublicPage[] = [
  {
    path: "/about",
    Page: AboutPage,
    metadata: aboutMetadata,
    title: "밴드 곡 투표 서비스 소개 - Plypick",
    h1: "밴드 곡 투표 서비스, Plypick",
    description:
      "Plypick(플리픽)은 밴드 멤버들이 후보곡을 투표로 고르고 공연 셋리스트까지 정하는 무료 웹 서비스예요. 익명 투표가 기본이고, 쉬는 시간까지 더한 공연 시간과 이미지·PDF 저장까지 돼요.",
    linksTo: ["/", "/guide", "/guide/choose-songs", "/guide/setlist"],
  },
  {
    path: "/guide",
    Page: GuidePage,
    metadata: guideMetadata,
    title: "사용 가이드: 후보곡 투표부터 셋리스트까지 - Plypick",
    h1: "Plypick 사용 가이드",
    description:
      "플레이리스트를 만들어 후보곡을 올리고, 밴드 멤버와 투표하고, 셋리스트를 짜서 이미지·PDF로 내보내기까지 Plypick 쓰는 법을 순서대로 안내해요.",
    linksTo: ["/", "/guide/setlist", "/guide/choose-songs", "/about"],
  },
  {
    path: "/guide/setlist",
    Page: SetlistGuidePage,
    metadata: setlistGuideMetadata,
    title: "밴드 셋리스트 짜는 법: 순서·시간·양식 - Plypick",
    h1: "밴드 셋리스트 짜는 법",
    description:
      "공연 곡 순서를 정하고, 멘트·튜닝 시간까지 더해 무대 시간에 맞추고, 무대에 붙일 셋리스트 양식까지 만드는 방법을 정리했어요. 30분 무대 예시도 있어요.",
    linksTo: ["/", "/guide", "/guide/choose-songs"],
  },
  {
    path: "/guide/choose-songs",
    Page: ChooseSongsGuidePage,
    metadata: chooseSongsGuideMetadata,
    title: "합주곡·공연곡 정하는 법: 투표로 정하기 - Plypick",
    h1: "합주곡·공연곡, 투표로 정하는 법",
    description:
      "후보곡 고르는 기준부터 투표 방식, 마감, 동점일 때, 카톡 투표와 다른 점까지 밴드가 합주곡과 공연곡을 투표로 정하는 방법을 정리했어요.",
    linksTo: ["/", "/guide", "/guide/setlist"],
  },
];

describe.each(PAGES)("$path", (page) => {
  it("has its own title, description and canonical", () => {
    expect(page.metadata.title).toBe(page.title);
    expect(page.metadata.description).toBe(page.description);
    expect(page.metadata.alternates?.canonical).toBe(page.path);
  });

  it("has one H1", () => {
    render(<page.Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(page.h1);
  });

  it("shows real product screens, each described in its alt text", () => {
    render(<page.Page />);
    const images = shownImages();
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.alt.trim(), image.path).not.toBe("");
      publicFileOf(`${SITE_URL}${image.path}`);
    }
  });

  it("links to the pages search engines should reach next", () => {
    render(<page.Page />);
    expect(linkTargets()).toEqual(expect.arrayContaining(page.linksTo));
  });
});

describe.each(PAGES.filter((page) => page.path.startsWith("/guide/")))("$path structured data", (page) => {
  it("is an article whose headline is the H1 and whose images are the screens it shows", () => {
    render(<page.Page />);
    const article = jsonLdNodes().find((node) => node["@type"] === "Article")!;
    expect(article.headline).toBe(page.h1);
    expect(article.mainEntityOfPage).toBe(`${SITE_URL}${page.path}`);
    const shown = shownImages().map((image) => image.path);
    expect((article.image as string[]).map(publicFileOf)).toEqual(shown);
  });

  it("has a breadcrumb that the page also shows as links", () => {
    render(<page.Page />);
    const breadcrumb = jsonLdNodes().find((node) => node["@type"] === "BreadcrumbList")!;
    const items = breadcrumb.itemListElement as { position: number; name: string; item: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items.at(-1)).toMatchObject({ name: page.h1, item: `${SITE_URL}${page.path}` });
    const trail = screen.getByRole("navigation", { name: "이동 경로" });
    for (const item of items.slice(0, -1)) {
      expect(trail.querySelector(`a[href="${item.item.slice(SITE_URL.length) || "/"}"]`), item.name).toHaveTextContent(item.name);
    }
  });
});

describe("/guide/setlist 30-minute example", () => {
  it("ends where the text says, leaving the two to three minute buffer it recommends", () => {
    render(<SetlistGuidePage />);
    const table = screen.getByRole("table", { name: "30분 무대 셋리스트 예시" });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows[rows.length - 1]).toHaveTextContent("끝27:20");
    expect(screen.getByText(/27분 20초라서 2분 40초 여유가 남아요/)).toBeInTheDocument();
  });
});

describe("sitemap", () => {
  it("lists every public page at its canonical URL", () => {
    const urls = sitemap().map((entry) => entry.url);
    const canonicals = [...PAGES.map((page) => page.metadata), privacyMetadata, termsMetadata, supportMetadata].map(
      (metadata) => metadata.alternates?.canonical,
    );
    for (const canonical of canonicals) expect(urls).toContain(`${SITE_URL}${canonical}`);
    expect(urls).toContain(SITE_URL);
  });
});
