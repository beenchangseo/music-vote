import type { Metadata } from "next";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProductShot from "@/components/guide/ProductShot";
import RelatedGuides from "@/components/guide/RelatedGuides";
import { PRODUCT_SCREENSHOTS, pageMetadata } from "@/lib/seo";

// "밴드 투표" means Naver BAND app polls on both search engines, so the title says 밴드 곡 투표.
// 플리픽 is the Korean spelling Naver autocompletes for the brand.
export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "밴드 곡 투표 서비스 소개 - Plypick",
  description:
    "Plypick(플리픽)은 밴드 멤버들이 후보곡을 투표로 고르고 공연 셋리스트까지 정하는 무료 웹 서비스예요. 익명 투표가 기본이고, 쉬는 시간까지 더한 공연 시간과 이미지·PDF 저장까지 돼요.",
  ogTitle: "밴드 곡 투표 서비스 Plypick",
});

const FEATURES = [
  {
    title: "YouTube로 바로 듣기",
    desc: "곡 이름으로 찾거나 YouTube 링크를 붙여 넣으면 제목과 썸네일이 자동으로 채워져요. 투표 전에 목록에서 바로 들어 봐요.",
  },
  {
    title: "공평한 투표",
    desc: "멤버가 찬성·반대로 투표하고 점수순으로 자동 정렬돼요. 익명이 기본이라 반대도 편하게 눌러요. 방장이 투표권을 나눠 주면 마음이 더 가는 곡에 표를 몰아줄 수도 있어요.",
  },
  {
    title: "링크 하나로 시작",
    desc: "카카오 로그인 한 번이면 바로 참여할 수 있어요. 닉네임도 자동이라 따로 입력할 게 없어요.",
  },
  {
    title: "마감일 설정",
    desc: "합주 전날까지 투표를 마감하면, 합주 당일에는 연습에만 집중할 수 있어요.",
  },
  {
    title: "셋리스트와 공연 시간",
    desc: "표 많이 받은 곡으로 셋리스트를 짜고, 멘트·튜닝 같은 쉬는 시간까지 더한 총 공연 시간을 봐요. 이미지와 PDF로 저장해요.",
  },
  {
    title: "밴드로 묶기",
    desc: "같은 멤버끼리 밴드를 만들면 밴드 홈에 플레이리스트와 지금까지 셋리스트에 넣은 곡이 모여요.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-full bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-h1 font-bold text-text mb-4">밴드 곡 투표 서비스, Plypick</h1>
        <p className="text-text-muted mb-8">
          밴드 셋리스트, 아직도 단톡방에서 정하고 계신가요?
        </p>

        <div className="space-y-8 break-keep text-text-muted leading-relaxed">
          <section>
            <h2 className="text-h3 font-semibold text-text mb-3">
              셋리스트 정하기, 왜 어려울까?
            </h2>
            <p>
              밴드 활동에서 가장 많이 반복되는 논의 중 하나가 &quot;다음에 뭐 치지?&quot;예요.
              카카오톡이나 밴드 단톡방에서 곡 후보를 던지고, 각자 의견을 말하고,
              결국 목소리 큰 사람 의견대로 정해지는 경우가 많아요.
            </p>
            <p className="mt-2">
              모든 멤버의 의견을 공평하게 반영하고, 곡을 미리 들어보면서
              투표할 수 있다면 어떨까요?
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-semibold text-text mb-3">
              Plypick으로 이렇게 정해요
            </h2>
            <p>
              Plypick(플리픽)은 밴드 멤버들이 다음 공연이나 합주에서 연주할 곡을 투표로 고르고, 고른 곡으로 셋리스트까지 짜는 무료
              웹 서비스예요.
            </p>
            <ul className="mt-4 space-y-3">
              {FEATURES.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <div className="size-1.5 rounded-pill bg-primary mt-2.5 shrink-0" />
                  <div>
                    <p className="font-medium text-text">{item.title}</p>
                    <p className="text-text-muted">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ProductShot
              shot={PRODUCT_SCREENSHOTS.candidates}
              sizes="320px"
              className="mx-auto mt-6 max-w-xs"
              caption="후보곡 탭. 가상의 밴드로 만든 예시예요."
            />
          </section>

          <section>
            <h2 className="text-h3 font-semibold text-text mb-3">
              이런 분들께 추천해요
            </h2>
            <ul className="space-y-2 text-text-muted">
              <li>• 공연이나 합주 셋리스트를 매번 톡방에서 정하는 밴드</li>
              <li>• 멤버 의견을 공평하게 반영하고 싶은 밴드 리더</li>
              <li>• 곡을 미리 들어보고 투표하고 싶은 밴드 멤버</li>
              <li>• 동아리, 학교 밴드부, 교회 찬양팀 등 음악 그룹</li>
            </ul>
          </section>

          <RelatedGuides guides={["chooseSongs", "setlist", "guide"]} />

          <Card padding="lg" className="text-center">
            <p className="text-h4 font-semibold text-text mb-2">
              다음 합주곡, 투표로 정해요
            </p>
            <p className="text-sm text-text-muted mb-4">
              무료예요. 카카오 로그인 한 번이면 30초 만에 플레이리스트를 만들 수 있어요.
            </p>
            <Link href="/" className={buttonClassName({ size: "lg" })}>
              플레이리스트 만들기
            </Link>
          </Card>
        </div>

        <div className="mt-12 pt-6 border-t border-border">
          <Link href="/" className="text-sm text-text-subtle hover:text-primary-fg transition-colors">
            &larr; 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
