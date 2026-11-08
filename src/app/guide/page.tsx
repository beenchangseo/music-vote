import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProductShot from "@/components/guide/ProductShot";
import RelatedGuides from "@/components/guide/RelatedGuides";
import { PRODUCT_SCREENSHOTS, pageMetadata } from "@/lib/seo";

// The usage hub. "셋리스트 짜는 법" belongs to /guide/setlist, so this title stays on using the app.
export const metadata: Metadata = pageMetadata({
  path: "/guide",
  title: "사용 가이드: 후보곡 투표부터 셋리스트까지 - Plypick",
  description:
    "플레이리스트를 만들어 후보곡을 올리고, 밴드 멤버와 투표하고, 셋리스트를 짜서 이미지·PDF로 내보내기까지 Plypick 쓰는 법을 순서대로 안내해요.",
  ogTitle: "Plypick 사용 가이드",
});

function StepHeading({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="size-8 rounded-control bg-primary-tint flex items-center justify-center text-on-primary-tint font-bold text-sm">
        {step}
      </div>
      <h2 className="text-h3 font-semibold text-text">{children}</h2>
    </div>
  );
}

export default function GuidePage() {
  return (
    <main className="min-h-full bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-h1 font-bold text-text mb-4">Plypick 사용 가이드</h1>
        <p className="text-text-muted mb-8">후보곡 투표부터 합주 날까지, Plypick 쓰는 법을 순서대로 알려 드려요.</p>

        <div className="space-y-10 break-keep text-text-muted leading-relaxed">
          <section>
            <StepHeading step={1}>플레이리스트 만들기</StepHeading>
            <p>
              홈에서 카카오 로그인 한 번 하고 플레이리스트 이름을 적어요. 공연명이나 날짜를 넣으면 구분하기 쉬워요. 예:
              &quot;11월 정기공연 후보곡&quot;, &quot;2학기 축제 합주&quot;.
            </p>
            <p className="mt-2">
              옵션에서 투표 방식(자유 투표·투표권 할당), 투표 마감일, 셋리스트 곡 수를 정해요. 마감일과 셋리스트 곡 수는 만든 뒤에
              바꿀 수 없고, 투표 방식은 투표가 시작되면 바꿀 수 없어요.
            </p>
          </section>

          <section>
            <StepHeading step={2}>후보곡 올리기</StepHeading>
            <p>
              곡 이름으로 찾거나 YouTube 링크를 붙여 넣어요. YouTube Music과 Shorts 링크도 돼요. 제목·아티스트·썸네일과 영상
              길이가 자동으로 들어가요.
            </p>
            <p className="mt-2">멤버마다 직접 올리게 하면 참여가 늘어요. 라이브나 커버 영상은 곡마다 &quot;다른 버전&quot;으로 달아 둬요.</p>
          </section>

          <section>
            <StepHeading step={3}>단톡방에 링크 보내기</StepHeading>
            <p>
              플레이리스트 위쪽의 카카오톡 버튼을 누르면 단톡방에 투표 카드가 올라가요. 만들 때 나오는 링크 복사와 QR 코드로도
              보낼 수 있어요.
            </p>
            <p className="mt-2">
              따로 가입할 건 없어요. 멤버는 링크를 열고 카카오 로그인 한 번이면 바로 투표해요. 닉네임은 카카오 프로필에서 가져와요.
            </p>
          </section>

          <section>
            <StepHeading step={4}>투표하기</StepHeading>
            <p>
              곡마다 찬성이나 반대를 눌러요. 목록은 점수순으로 바로 다시 정렬되고, 점수가 같은 곡은 같은 순위 번호를 달아요. 자유
              투표에서는 같은 버튼을 다시 누르면 취소되고, 반대쪽을 누르면 바뀌어요. 투표권 할당에서는 같은 쪽을 누를 때마다 표가
              하나씩 늘며 투표권을 쓰고, 반대쪽을 누르면 한 표를 거둬 투표권을 돌려받아요. 남은 투표권은 목록 위에 보여요.
            </p>
            <p className="mt-2">
              투표는 익명이 기본이에요. 방장이 플레이리스트 설정에서 기명 투표로 바꾸면 이미 한 표까지 닉네임과 찬반이 보여요.
            </p>
            <ProductShot
              shot={PRODUCT_SCREENSHOTS.candidates}
              sizes="320px"
              className="mx-auto mt-5 max-w-xs"
              caption="후보곡 탭. 가상의 밴드로 만든 예시예요."
            />
          </section>

          <section>
            <StepHeading step={5}>셋리스트 짜기</StepHeading>
            <p>
              셋리스트 탭의 &quot;후보곡에서 넣기&quot;에서 점수 높은 곡부터 넣어요. 넣은 곡은 셋리스트 맨 끝에 붙어요. 밴드 자작곡은
              자작곡 블록으로, 멘트·튜닝·악기 점검 시간은 인터벌 블록으로 넣어요.
            </p>
            <p className="mt-2">
              편집을 누르면 ≡를 끌어 순서를 바꾸고, (+)로 원하는 자리에 블록을 넣어요. 위에는 총 공연 시간이, 블록마다 몇 분에
              시작하는지가 붙어요. 시간이 비어 있는 곡이 있으면 몇 곡인지 따로 알려 줘요.
            </p>
            <p className="mt-2">
              셋리스트에서 고친 곡 제목과 시간은 셋리스트에만 적용되고, 후보곡의 원래 정보는 그대로 남아요. 셋리스트를 모두가
              고칠지 방장만 고칠지는 플레이리스트 설정에서 정해요.
            </p>
            <p className="mt-2">
              마감일과 셋리스트 곡 수를 정해 뒀다면 마감 뒤 방장이 후보곡 탭에서 셋리스트를 바로 확정할 수 있어요. 방장이 확정하지
              않으면 마감 뒤 처음 오는 자정에 자동으로 확정돼요. 셋리스트가 비어 있으면 점수 높은 곡부터 그 수만큼 채우고, 짜 둔 셋리스트가 있으면
              그대로 확정해요.
            </p>
            <ProductShot
              shot={PRODUCT_SCREENSHOTS.setlist}
              sizes="320px"
              className="mx-auto mt-5 max-w-xs"
              caption="셋리스트 탭. 인터벌까지 더한 총 공연 시간과 블록마다 시작 시각이 보여요."
            />
          </section>

          <section>
            <StepHeading step={6}>내보내기와 공유</StepHeading>
            <p>
              셋리스트 탭의 내보내기에서 링크 공유, 이미지로 저장, PDF로 저장을 골라요. 이미지는 휴대폰에서 보기 좋은 세로 한
              장이고, PDF는 A4 여러 페이지에 전체 셋리스트를 담아요. 마감 뒤 셋리스트가 확정되면 후보곡 탭에서 카톡 공유 카드로도
              보내요.
            </p>
          </section>

          <section>
            <StepHeading step={7}>합주 탭</StepHeading>
            <p>
              합주 날에는 합주 탭을 열어요. 셋리스트 순서대로 지금 곡과 다음 곡을 넘기고, 곡마다 키·BPM·길이를 보여 줘요. BPM을 적어
              두면 메트로놈을 켤 수 있고, 탭 템포로 BPM을 맞출 수도 있어요. 곡마다 남긴 코멘트도 여기서 봐요.
            </p>
          </section>

          <section>
            <StepHeading step={8}>밴드로 묶기</StepHeading>
            <p>
              같은 멤버와 계속 쓴다면 밴드를 만들어요. 홈의 &quot;밴드 만들기&quot;에서 같이 투표한 멤버로 바로 만들거나, 밴드를 먼저
              만들고 단톡방에 초대 링크를 보내요.
            </p>
            <p className="mt-2">
              밴드 홈에는 밴드의 플레이리스트가 투표 중, 셋리스트 짜는 중, 셋리스트 확정 같은 단계 배지와 함께 모여요. 공연 날짜를
              정하면 D-day가 보이고, 지금까지 셋리스트에 넣었던 곡도 한곳에 쌓여요.
            </p>
            <ProductShot
              shot={PRODUCT_SCREENSHOTS.bandHome}
              sizes="320px"
              className="mx-auto mt-5 max-w-xs"
              caption="밴드 홈. 가상의 밴드로 만든 예시예요."
            />
          </section>

          <Card padding="lg">
            <h2 className="text-h4 font-semibold text-text mb-3">투표를 빨리 끝내는 팁</h2>
            <ul className="space-y-2 text-text-muted text-sm">
              <li>• 후보는 정할 곡 수의 두 배쯤으로 추려요</li>
              <li>• 마감은 합주 전날 밤으로 잡아요</li>
              <li>• 멤버마다 직접 2~3곡씩 올리게 해요</li>
              <li>• 투표 방식은 링크를 보내기 전에 정해요</li>
            </ul>
          </Card>

          <RelatedGuides guides={["setlist", "chooseSongs", "about"]} />

          <section className="text-center">
            <Link href="/" className={buttonClassName({ size: "lg" })}>
              지금 플레이리스트 만들기
            </Link>
          </section>
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
