import { ListRowLink } from "@/components/ui/ListRow";
import { GUIDE_ARTICLES } from "@/lib/seo";
import { ChevronIcon } from "@/components/ui/icons";

// Link text is the page's search phrase, which tells search engines what the page answers.
const GUIDES = {
  setlist: {
    href: GUIDE_ARTICLES.setlist.path,
    title: GUIDE_ARTICLES.setlist.headline,
    description: "첫 곡과 마지막 곡, 멘트 자리, 30분 무대 시간 맞추기, 무대용 양식",
  },
  chooseSongs: {
    href: GUIDE_ARTICLES.chooseSongs.path,
    title: GUIDE_ARTICLES.chooseSongs.headline,
    description: "후보 고르는 기준, 투표 방식, 마감, 동점일 때, 카톡 투표와 다른 점",
  },
  guide: {
    href: "/guide",
    title: "Plypick 사용 가이드",
    description: "플레이리스트 만들기부터 셋리스트 내보내기, 합주 탭, 밴드까지",
  },
  about: {
    href: "/about",
    title: "밴드 곡 투표 서비스 소개",
    description: "Plypick이 어떤 서비스이고 어떤 밴드에 맞는지",
  },
};

export type RelatedGuide = keyof typeof GUIDES;

export default function RelatedGuides({ guides }: { guides: RelatedGuide[] }) {
  return (
    <section aria-labelledby="related-guides">
      <h2 id="related-guides" className="mb-2 text-h3 font-semibold text-text">
        더 읽어 보기
      </h2>
      <ul>
        {guides.map((key) => (
          <li key={key}>
            <ListRowLink
              href={GUIDES[key].href}
              trailing={
                <ChevronIcon direction="right" className="size-5 text-text-subtle" />
              }
            >
              <span className="block break-keep text-body font-semibold text-primary-fg">{GUIDES[key].title}</span>
              <span className="block break-keep text-sm text-text-muted">{GUIDES[key].description}</span>
            </ListRowLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
