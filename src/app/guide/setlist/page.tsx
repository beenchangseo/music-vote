import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import FaqList from "@/components/ui/FaqList";
import GuideArticleLayout, { GuideList, GuideSection } from "@/components/guide/GuideArticleLayout";
import ProductShot from "@/components/guide/ProductShot";
import { formatRuntime } from "@/domain/setlist";
import { GUIDE_ARTICLES, PRODUCT_SCREENSHOTS, pageMetadata } from "@/lib/seo";

const ARTICLE = GUIDE_ARTICLES.setlist;

export const metadata: Metadata = pageMetadata({
  path: ARTICLE.path,
  title: ARTICLE.title,
  description: ARTICLE.description,
  ogTitle: ARTICLE.headline,
});

// The 30-minute example, in seconds. The setlist screenshot shows the same blocks with made-up song names.
const EXAMPLE_BLOCKS = [
  { no: "1", block: "첫 곡 (빠르고 다 아는 곡)", seconds: 220 },
  { no: "2", block: "두 번째 곡", seconds: 245 },
  { no: "", block: "인사·멤버 소개 멘트", seconds: 90 },
  { no: "3", block: "세 번째 곡", seconds: 230 },
  { no: "4", block: "느린 곡", seconds: 270 },
  { no: "", block: "튜닝 바꾸기 (반음 내림)", seconds: 60 },
  { no: "5", block: "자작곡", seconds: 235 },
  { no: "", block: "마지막 곡 소개 멘트", seconds: 30 },
  { no: "6", block: "마지막 곡", seconds: 260 },
] as const;
const EXAMPLE = EXAMPLE_BLOCKS.map((row, index) => ({
  ...row,
  start: EXAMPLE_BLOCKS.slice(0, index).reduce((sum, before) => sum + before.seconds, 0),
}));
const EXAMPLE_END = EXAMPLE_BLOCKS.reduce((sum, row) => sum + row.seconds, 0);

const FAQ = [
  {
    question: "30분 공연이면 몇 곡을 준비해요?",
    answer:
      "곡이 4분 안팎이면 6곡 정도예요. 30분에서 멘트·세팅 시간 3분쯤과 여유 3분쯤을 빼면 곡에 쓸 시간이 24분 남아요.",
  },
  {
    question: "셋리스트와 큐시트는 뭐가 달라요?",
    answer:
      "셋리스트는 밴드가 칠 곡의 순서예요. 큐시트는 행사 전체 진행표라서 순서마다 시작 시각과 조명·음향 신호까지 적어요. 여러 팀이 서는 행사라면 큐시트에서 우리 순서의 시간을 먼저 확인하고, 그 안에 셋리스트를 맞춰요.",
  },
  {
    question: "곡 길이를 모르면 어떻게 해요?",
    answer:
      "합주 때 처음부터 끝까지 한 번 쳐 보고 재요. Plypick은 곡 시간을 YouTube 영상 길이로 먼저 채우는데, 영상에는 앞뒤 장면이나 박수 소리가 들어 있기도 해서 실제 연주 길이와 다를 수 있어요.",
  },
];

export default function SetlistGuidePage() {
  return (
    <GuideArticleLayout
      article={ARTICLE}
      images={[PRODUCT_SCREENSHOTS.setlist, PRODUCT_SCREENSHOTS.setlistImage]}
      lead={<p>곡을 다 정했다면 이제 순서와 시간을 맞출 차례예요. 공연 전 합주에서 밴드가 정해야 하는 것들을 순서대로 적었어요.</p>}
      related={["chooseSongs", "guide"]}
    >
      <Card padding="lg">
        <h2 className="text-h4 font-semibold text-text">셋리스트(셋리)란?</h2>
        <p className="mt-2">
          셋리스트는 공연에서 연주할 곡을 순서대로 적은 목록이에요. 줄여서 셋리라고도 하고, 콘서트를 다녀온 팬들이 &quot;오늘
          셋리&quot;를 올릴 때 보는 그 목록이에요. 밴드에게는 무대에 들고 올라가는 진행표라서, 몇 번째에 무슨 곡을 치고 어디서
          멘트를 하고 전체가 몇 분인지까지 담아요.
        </p>
      </Card>

      <GuideSection title="곡부터 정해요">
        <p>
          순서는 곡이 정해진 다음 일이에요. 후보가 공연 시간보다 많으면 먼저 멤버끼리 투표로 줄여요. 후보 고르는 기준과 투표로
          정하는 방법은{" "}
          <Link href={GUIDE_ARTICLES.chooseSongs.path} className="font-semibold text-primary-fg underline underline-offset-2">
            {GUIDE_ARTICLES.chooseSongs.headline}
          </Link>
          에 따로 정리했어요.
        </p>
      </GuideSection>

      <GuideSection title="첫 곡과 마지막 곡을 먼저 정해요">
        <p>순서를 처음부터 차례로 채우면 가운데에 비슷한 곡이 뭉쳐요. 양 끝을 먼저 정하고 가운데를 채우는 편이 쉬워요.</p>
        <GuideList>
          <li>첫 곡은 멤버 모두가 가장 자신 있는 곡으로 골라요. 무대에 막 올라가면 긴장해서 템포가 빨라지고, 모니터 소리도 아직 낯설어요.</li>
          <li>첫 곡은 인트로가 짧고 밴드 전체가 바로 들어가는 곡이 좋아요. 조용한 솔로로 시작하면 객석이 어수선한 채로 지나가요.</li>
          <li>마지막 곡은 객석 반응이 가장 클 곡이에요. 다 같이 아는 곡이나 우리 밴드가 제일 잘 맞는 곡을 둬요.</li>
          <li>마지막 곡 앞에는 짧은 멘트 자리를 남겨 둬요. &quot;마지막 곡입니다&quot; 한마디가 있으면 끝이 덜 어색해요.</li>
        </GuideList>
      </GuideSection>

      <GuideSection title="가운데는 흐름으로 짜요">
        <GuideList>
          <li>빠른 곡과 느린 곡을 한 곡씩 번갈아 두기보다 두세 곡씩 묶어요. 매 곡 분위기가 바뀌면 객석이 따라오기 힘들어요.</li>
          <li>느린 곡은 가운데쯤 한 번 둬요. 보컬이 숨을 고르고, 그다음 빠른 곡이 더 크게 들려요.</li>
          <li>고음이 많은 곡은 연달아 두지 않아요. 보컬 목은 공연 후반으로 갈수록 지쳐요.</li>
          <li>곡마다 BPM을 적어 두면 비슷한 빠르기의 곡이 줄줄이 붙어 있는지 한눈에 보여요.</li>
        </GuideList>
      </GuideSection>

      <GuideSection title="키·튜닝·악기 교체는 묶어요">
        <GuideList>
          <li>드롭 D나 반음 내림처럼 튜닝이 다른 곡은 같은 튜닝끼리 붙여요. 튜닝을 바꾸는 동안은 멘트로 메워요.</li>
          <li>카포 위치를 바꾸거나, 어쿠스틱 기타로 바꾸거나, 건반 음색을 크게 바꾸는 곡도 바꾸는 시간이 들어요. 그 자리를 셋리스트에 적어 둬요.</li>
          <li>원키보다 내려서 치는 곡은 키를 같이 적어요. 무대에서 누군가 원키로 들어가는 실수를 막아요.</li>
        </GuideList>
        <p>
          Plypick에서는 합주 탭에서 곡마다 키, BPM, 메모(예: 1키 다운, capo 2)를 적어요. 적어 둔 BPM과 키는 셋리스트의 곡 블록에도
          같이 보여요.
        </p>
      </GuideSection>

      <GuideSection title="멘트와 세팅 시간도 넣어요">
        <p>
          멘트는 두세 번이면 충분해요. 앞쪽에 인사, 가운데쯤 멤버 소개, 마지막 곡 앞에 한마디가 흔한 자리예요. 인사나 멤버 소개는
          1~2분, 마지막 곡 앞 한마디는 30초쯤, 튜닝이나 악기 교체는 1분쯤 잡아요.
        </p>
        <p>이 시간을 빼고 곡 길이만 더하면 숫자는 맞아 보여도 무대에서 시간이 모자라요.</p>
        <p>
          Plypick 셋리스트에서는 곡 사이에 인터벌 블록을 넣어요. 이름, 설명, 시간을 적고, 인터벌 시간도 총 공연 시간에 더해져요.
          밴드 자작곡은 후보곡 없이 자작곡 블록으로 바로 넣어요.
        </p>
      </GuideSection>

      <GuideSection title="공연 시간에 맞춰요">
        <p>공연 시간은 곡 길이와 멘트·세팅 시간을 모두 더한 값이에요. 여기에 두 가지를 더 챙겨요.</p>
        <GuideList>
          <li>곡 길이는 원곡이 아니라 우리가 칠 버전의 길이예요. 인트로를 줄이거나 엔딩을 늘렸다면 합주 때 한 번 재 봐요.</li>
          <li>주어진 시간을 꽉 채우지 말고 2~3분 남겨요. 곡 사이 넘어가는 시간, 늦어지는 시작, 장비 문제가 그 여유를 써요.</li>
        </GuideList>
        <p>30분 무대 예시예요. 곡 6곡에 멘트 두 번과 튜닝 시간을 넣으면 27분 20초라서 2분 40초 여유가 남아요.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-card border border-border text-sm">
            <caption className="sr-only">30분 무대 셋리스트 예시</caption>
            <thead>
              <tr className="bg-surface text-caption text-text-muted">
                <th scope="col" className="w-10 px-3 py-2.5 text-left font-bold">
                  순서
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-bold">
                  블록
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">
                  길이
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">
                  시작
                </th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE.map((row) => (
                <tr key={row.start} className={row.no ? "text-text" : "text-text-muted"}>
                  <td className="border-t border-border px-3 py-2.5 tabular-nums">{row.no || "·"}</td>
                  <td className="border-t border-border px-3 py-2.5">{row.block}</td>
                  <td className="border-t border-border px-3 py-2.5 text-right tabular-nums">{formatRuntime(row.seconds)}</td>
                  <td className="border-t border-border px-3 py-2.5 text-right tabular-nums">{formatRuntime(row.start)}</td>
                </tr>
              ))}
              <tr className="font-bold text-text">
                <td className="border-t border-border px-3 py-2.5" />
                <td className="border-t border-border px-3 py-2.5">끝</td>
                <td className="border-t border-border px-3 py-2.5" />
                <td className="border-t border-border px-3 py-2.5 text-right tabular-nums">{formatRuntime(EXAMPLE_END)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Plypick 셋리스트는 블록마다 몇 분에 시작하는지와 총 공연 시간을 바로 더해 보여 줘요. 곡 시간은 YouTube 영상 길이로 먼저
          채워지니, 실제로 칠 길이가 다르면 셋리스트에서 고쳐요. 후보곡에 적힌 원래 시간은 그대로 남아요. 시간이 비어 있는 곡이
          있으면 몇 곡이 비었는지 따로 알려 줘요.
        </p>
        <ProductShot
          shot={PRODUCT_SCREENSHOTS.setlist}
          sizes="320px"
          className="mx-auto max-w-xs"
          caption="위 예시를 Plypick 셋리스트에 넣은 화면이에요. 밴드와 곡 이름은 지어낸 거예요."
        />
      </GuideSection>

      <GuideSection title="앵콜은 따로 정해 둬요">
        <GuideList>
          <li>앵콜을 받을지 공연 전에 정해요. 시간 제한이 있는 무대라면 앵콜까지 넣어서 시간을 맞춰요.</li>
          <li>앵콜곡은 셋리스트 맨 끝에 따로 적어요. 그날 반응이 가장 좋았던 곡을 한 번 더 하거나, 객석이 따라 부를 수 있는 곡을 아껴 둬요.</li>
        </GuideList>
        <p>Plypick에서는 &quot;앵콜&quot;이라는 인터벌 블록 뒤에 앵콜곡을 넣어 두면 어디부터 앵콜인지 셋리스트에서 바로 보여요.</p>
      </GuideSection>

      <GuideSection title="무대용 셋리스트 양식">
        <p>무대 바닥에 붙이는 종이 셋리스트는 서서 내려다봐도 한눈에 읽혀야 해요. 담을 것은 이 정도면 충분해요.</p>
        <GuideList>
          <li>번호와 곡 제목. 제목을 가장 크고 굵게 써요.</li>
          <li>키나 튜닝이 바뀌는 곡 표시. 예: -2, 드롭 D.</li>
          <li>멘트 자리와 악기 교체 자리.</li>
          <li>앵콜곡은 한 줄 띄우고 맨 아래에.</li>
        </GuideList>
        <p>
          곡이 10곡을 넘으면 글씨가 작아지니 두 장으로 나눠요. 어두운 무대가 많아서 흰 종이에 굵은 검은 글씨가 가장 잘 보여요.
          보컬 발밑, 드럼 옆처럼 멤버마다 보이는 자리에 한 장씩 붙여요.
        </p>
        <p>
          Plypick에서는 셋리스트 탭 제목 아래 공유 버튼을 눌러 이미지나 PDF로 저장해요. 이미지는 휴대폰에서 보기 좋은 세로 한 장이고, BPM과 곡
          길이가 같이 들어가요. 셋리스트가 길어서 이미지 한 장에 다 들어가지 않으면 PDF로 저장해요. PDF는 A4 크기로 여러 페이지에
          전부 담아서 보면대나 합주실에 두기 좋아요. 무대 바닥용은 곡 제목만 크게 따로 뽑는 편이 읽기 편해요.
        </p>
        <ProductShot
          shot={PRODUCT_SCREENSHOTS.setlistImage}
          sizes="320px"
          className="mx-auto max-w-xs"
          caption="Plypick에서 저장한 셋리스트 이미지예요. 가상의 밴드로 만든 예시예요."
        />
      </GuideSection>

      <GuideSection title="단톡방에 공유해요">
        <p>
          순서가 정해지면 멤버 모두가 같은 셋리스트를 보고 연습해요. 셋리스트 이미지를 단톡방에 올리거나 셋리스트 링크를 보내면,
          멤버는 링크를 눌러 셋리스트 탭을 바로 열어요. 마감 뒤 셋리스트가 확정되면 후보곡 탭에서 카톡 공유 카드로도 보낼 수
          있어요.
        </p>
        <p>합주 날에는 합주 탭을 열어요. 셋리스트 순서대로 지금 곡과 다음 곡을 넘기고, 곡마다 키·BPM·길이를 보여 줘요.</p>
      </GuideSection>

      <GuideSection title="자주 묻는 질문">
        <FaqList items={FAQ} />
      </GuideSection>
    </GuideArticleLayout>
  );
}
