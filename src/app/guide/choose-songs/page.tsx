import type { Metadata } from "next";
import Link from "next/link";
import FaqList from "@/components/ui/FaqList";
import GuideArticleLayout, { GuideList, GuideSection } from "@/components/guide/GuideArticleLayout";
import ProductShot from "@/components/guide/ProductShot";
import { GUIDE_ARTICLES, PRODUCT_SCREENSHOTS, pageMetadata } from "@/lib/seo";

const ARTICLE = GUIDE_ARTICLES.chooseSongs;

export const metadata: Metadata = pageMetadata({
  path: ARTICLE.path,
  title: ARTICLE.title,
  description: ARTICLE.description,
  ogTitle: ARTICLE.headline,
});

const FAQ = [
  {
    question: "후보는 몇 곡이 적당해요?",
    answer: "정할 곡 수의 두 배쯤이요. 공연에서 6곡을 한다면 12곡 안팎이에요. 멤버 넷이 3곡씩 올리면 그쯤 돼요.",
  },
  {
    question: "투표 안 하는 멤버는 어떻게 해요?",
    answer: "마감을 정해 두고, 마감 전날 단톡방에 링크를 한 번 더 올려요. 마감이 지나면 투표가 닫힌다는 걸 같이 알려요.",
  },
  {
    question: "기명 투표가 나을 때도 있어요?",
    answer:
      "누가 어떤 곡을 원하는지 알아야 파트를 나누기 쉬울 때가 있어요. 다만 기명으로 바꾸면 이미 한 표까지 닉네임과 찬반이 보이니, 바꾸기 전에 멤버에게 먼저 알려요.",
  },
];

export default function ChooseSongsGuidePage() {
  return (
    <GuideArticleLayout
      article={ARTICLE}
      images={[PRODUCT_SCREENSHOTS.candidates]}
      lead={
        <p>
          후보를 모으고, 기준을 맞추고, 투표로 정하기까지. 단톡방에서 매번 길어지는 곡 정하기를 한 번에 끝내는 방법이에요.
        </p>
      }
      related={["setlist", "guide"]}
    >
      <GuideSection title="단톡방에서 곡이 안 정해지는 이유">
        <p>
          후보곡 링크는 대화에 묻혀서 위로 한참 올려야 찾아요. 말을 많이 하는 멤버 의견대로 흘러가고, 읽고 답하지 않는 멤버도
          생겨요. 결국 누군가 &quot;그냥 이걸로 하자&quot;고 정리하고, 다음 합주 때 같은 얘기를 또 해요.
        </p>
        <p>후보를 한 목록에 모으고, 다 같이 들어 보고, 표로 정하면 이 과정이 짧아져요.</p>
      </GuideSection>

      <GuideSection title="후보곡 고르는 기준">
        <p>후보를 올리기 전에 이 다섯 가지를 먼저 따져 보면 투표에서 떨어질 곡이 줄어요.</p>
        <GuideList>
          <li>
            <strong className="text-text">우리 편성으로 되는지.</strong> 원곡에 건반, 브라스, 기타 두 대가 있는데 우리에게 없다면 그
            파트를 누가 어떻게 메울지 먼저 생각해요. 빠지는 파트가 곡의 중심 리프라면 후보에서 빼는 게 나아요.
          </li>
          <li>
            <strong className="text-text">보컬 키.</strong> 원키로 부를 수 없으면 몇 키 내릴지 정해요. 키를 내리면 기타 코드 모양과 곡
            분위기가 같이 바뀌니, 후보를 올리고 댓글에 &quot;원키 가능&quot;, &quot;-2&quot;처럼 적어 두면 투표하는 멤버가 판단하기 쉬워요.
          </li>
          <li>
            <strong className="text-text">난이도와 남은 합주 횟수.</strong> 공연까지 남은 합주 횟수를 세어 봐요. 처음 맞춰 보는 곡은 한
            번 합주로 완성되지 않아요. 남은 합주가 적으면 새 곡을 줄이고 이미 맞춰 본 곡을 섞어요.
          </li>
          <li>
            <strong className="text-text">무대 시간.</strong> 30분 무대면 6곡 안팎이에요. 후보는 정할 곡 수의 두 배쯤이면 고를 거리도
            있고 투표도 금방 끝나요.
          </li>
          <li>
            <strong className="text-text">관객.</strong> 학교 축제는 다 아는 곡이 반응이 크고, 정기공연은 우리가 하고 싶은 곡을 섞을 수
            있고, 회사 행사는 세대가 섞여 있어요. 누구 앞에서 치는지에 따라 같은 곡도 점수가 달라져요.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="후보 모으기">
        <p>멤버마다 2~3곡씩 올려요. 링크로 모으면 투표 전에 다 같이 들어 볼 수 있어요.</p>
        <p>
          Plypick에서는 곡 이름으로 찾거나 YouTube 링크를 붙여 넣어 후보를 올려요. 검색 결과는 추가하기 전에 미리 들어 볼 수 있고,
          제목·아티스트·썸네일과 영상 길이는 자동으로 채워져요. 라이브나 커버 영상도 참고하라고 곡마다 &quot;다른 버전&quot;으로 달아 둘
          수 있어요.
        </p>
      </GuideSection>

      <GuideSection title="투표 방식 정하기">
        <p>
          가장 단순한 방식은 곡마다 찬성(+1)이나 반대(-1)를 누르고 점수순으로 줄 세우는 거예요. 반대를 누를 수 있어서 &quot;이 곡은
          정말 못 하겠다&quot;도 표로 남아요.
        </p>
        <p>
          후보가 많아서 확 줄여야 하면 한 사람이 쓸 수 있는 표 수를 정해요. 표가 모자라니 꼭 하고 싶은 곡에 몰아주게 되고, 아무
          곡에나 찬성을 누르는 일이 줄어요.
        </p>
        <p>
          Plypick은 두 방식을 다 써요. 자유 투표는 곡마다 찬성이나 반대 한 표씩이고, 투표권 할당은 방장이 한 사람이 쓸 투표권 수를
          정해요. 투표권 할당에서는 한 곡에 표를 여러 개 줄 수 있어요. 투표가 시작되면 방식을 바꿀 수 없으니 링크를 보내기 전에
          정해요.
        </p>
        <ProductShot
          shot={PRODUCT_SCREENSHOTS.candidates}
          sizes="320px"
          className="mx-auto max-w-xs"
          caption="가상의 밴드로 만든 후보곡 탭이에요. 점수가 같은 곡은 같은 순위 번호를 달아요."
        />
      </GuideSection>

      <GuideSection title="익명 투표가 기본이에요">
        <p>
          반대를 편하게 누르려면 누가 눌렀는지 안 보여야 해요. Plypick은 익명 투표가 기본이라 누가 어느 곡에 표를 줬는지 다른
          멤버에게 보내지 않아요. 방장이 기명 투표로 바꾸면 이미 한 표까지 닉네임과 찬반이 보여요.
        </p>
      </GuideSection>

      <GuideSection title="마감 정하기">
        <p>마감이 없으면 투표는 끝나지 않아요. 합주 전날 밤으로 마감을 잡으면 합주 날 바로 연습을 시작할 수 있어요.</p>
        <p>
          Plypick에서는 플레이리스트를 만들 때 마감 날짜와 시간을 정해요. 만든 뒤에는 바꿀 수 없으니 처음에 정해요. 마감이 지나면
          투표와 곡 추가가 닫혀요.
        </p>
        <p>
          셋리스트 곡 수까지 정해 두면 마감 뒤 방장이 셋리스트를 바로 확정할 수 있고, 방장이 확정하지 않으면 마감 뒤 처음 오는
          자정에 자동으로 확정돼요. 셋리스트가 비어 있으면 점수 높은 곡부터 그 수만큼 채우고, 미리 짜 둔 셋리스트가 있으면 그대로
          확정해요.
        </p>
      </GuideSection>

      <GuideSection title="점수가 같거나 애매할 때">
        <p>
          점수가 같은 곡은 같은 순위 번호를 달고, 먼저 올라온 곡이 위에 놓여요. 셋리스트 곡 수로 채울 때도 이 순서를 따라요.
        </p>
        <p>동점인 곡이 마지막 한 자리를 다툰다면 다음 합주 때 둘 다 한 번씩 맞춰 보고 정해요.</p>
      </GuideSection>

      <GuideSection title="카톡 투표와 다른 점">
        <p>카톡 투표는 날짜나 장소처럼 선택지가 몇 개 안 될 때 빠르고 편해요. 곡을 정할 때는 아쉬운 점이 있어요.</p>
        <GuideList>
          <li>후보를 들어 보려면 대화에서 링크를 따로 찾아 열어야 해요. Plypick은 후보곡 목록에서 바로 재생해요.</li>
          <li>고르지 않는 것 말고는 &quot;이 곡은 별로&quot;를 표로 남길 방법이 없어요. Plypick은 반대를 눌러 점수를 깎아요.</li>
          <li>투표가 끝나도 곡 순서와 공연 시간은 손으로 다시 정리해야 해요. Plypick은 점수 높은 후보곡을 셋리스트에 바로 넣고 총 시간까지 더해요.</li>
        </GuideList>
        <p>
          단톡방은 그대로 써요. 플레이리스트 위쪽의 카카오톡 버튼을 누르면 단톡방에 투표 카드가 올라가고, 멤버는 카카오 로그인 한
          번이면 투표해요.
        </p>
      </GuideSection>

      <GuideSection title="정한 곡으로 셋리스트 짜기">
        <p>
          곡이 정해지면 순서와 시간을 맞출 차례예요. 첫 곡과 마지막 곡, 멘트 자리, 30분 무대 예시는{" "}
          <Link href={GUIDE_ARTICLES.setlist.path} className="font-semibold text-primary-fg underline underline-offset-2">
            {GUIDE_ARTICLES.setlist.headline}
          </Link>
          에 정리했어요.
        </p>
      </GuideSection>

      <GuideSection title="자주 묻는 질문">
        <FaqList items={FAQ} />
      </GuideSection>
    </GuideArticleLayout>
  );
}
