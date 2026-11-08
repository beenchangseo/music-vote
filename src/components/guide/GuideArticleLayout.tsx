import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { guideJsonLd, guideTrail, jsonLdScript, type GuideArticle, type ProductScreenshot } from "@/lib/seo";
import RelatedGuides, { type RelatedGuide } from "./RelatedGuides";

/** One topic of a guide: an H2 the reader can scan for, then its text. */
export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-h3 font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

/** A bulleted list in a guide's body. */
export function GuideList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-text-subtle">{children}</ul>;
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * A how-to page under /guide: the trail back to the usage guide, the H1, the date its structured data
 * carries, then the body, related guides and the way into the app.
 */
export default function GuideArticleLayout({
  article,
  images,
  lead,
  related,
  children,
}: {
  article: GuideArticle;
  /** The screens the body shows, in page order. They become the article's images. */
  images: readonly ProductScreenshot[];
  lead: ReactNode;
  related: RelatedGuide[];
  children: ReactNode;
}) {
  const trail = guideTrail(article);
  return (
    <main className="min-h-full bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(guideJsonLd(article, images)) }} />
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
        <nav aria-label="이동 경로">
          <ol className="flex flex-wrap items-center gap-x-1.5 text-caption text-text-subtle">
            {trail.map((step, index) =>
              index < trail.length - 1 ? (
                <li key={step.path} className="flex items-center gap-x-1.5">
                  <Link href={step.path} className="inline-flex min-h-11 items-center transition-colors hover:text-text-muted">
                    {step.name}
                  </Link>
                  <span aria-hidden>›</span>
                </li>
              ) : (
                <li key={step.path} aria-current="page" className="text-text-muted">
                  {step.name}
                </li>
              ),
            )}
          </ol>
        </nav>

        <h1 className="mt-4 break-keep text-h1 font-bold text-text">{article.headline}</h1>
        <p className="mt-2 text-caption text-text-subtle">
          <time dateTime={article.modified}>{dateLabel(article.modified)}</time> · Plypick
        </p>
        <div className="mt-6 mb-10 break-keep text-body text-text-muted leading-relaxed">{lead}</div>

        <div className="space-y-12 break-keep text-text-muted leading-relaxed">
          {children}

          <Card padding="lg" className="text-center">
            <p className="text-h4 font-semibold text-text">후보곡 투표부터 셋리스트까지 한곳에서</p>
            <p className="mt-2 mb-4 text-sm text-text-muted">무료예요. 카카오 로그인 한 번이면 플레이리스트를 만들어요.</p>
            <Link href="/" className={buttonClassName({ size: "lg" })}>
              플레이리스트 만들기
            </Link>
          </Card>

          <RelatedGuides guides={related} />
        </div>
      </div>
    </main>
  );
}
