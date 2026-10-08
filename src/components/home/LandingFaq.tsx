import type { FaqEntry } from "@/lib/seo";

// 랜딩 FAQ. 같은 목록이 화면과 FAQPage 구조화 데이터를 함께 만든다 — 둘이 어긋나면 안 된다.
// 답은 제품 사실만: 무료(/about), 카카오 로그인 1회(docs/adr/0009), 익명 기본과 기명 전환(docs/adr/0011,
// votes_anonymous DEFAULT TRUE), 유튜브 링크·검색(src/lib/youtube.ts), 토탈 시간(docs/adr/0004).
export const LANDING_FAQ: FaqEntry[] = [
  {
    question: "Plypick은 무료인가요?",
    answer: "네, 무료 웹 서비스예요. 카카오 로그인 한 번이면 바로 플레이리스트를 만들 수 있어요.",
  },
  {
    question: "밴드 멤버도 가입해야 하나요?",
    answer:
      "따로 적을 가입 양식은 없어요. 단톡방에서 링크를 열고 카카오 로그인 한 번이면 바로 투표해요. 닉네임은 카카오 프로필에서 가져와요.",
  },
  {
    question: "익명으로 투표할 수 있나요?",
    answer:
      "네, 익명이 기본이에요. 누가 어느 곡에 표를 줬는지는 화면에서만 가리는 게 아니라 다른 멤버에게 아예 보내지 않아요. 방장이 기명으로 바꾸면 이미 한 표까지 닉네임과 찬반이 보여요.",
  },
  {
    question: "합주곡 후보는 어떻게 올리나요?",
    answer:
      "곡 이름으로 검색하거나 YouTube 링크를 붙여 넣으면 돼요. 제목·아티스트·썸네일은 자동으로 채워지고, YouTube Music·Shorts 링크도 돼요.",
  },
  {
    question: "셋리스트 공연 시간은 어떻게 계산하나요?",
    answer:
      "셋리스트에 넣은 곡 시간과 곡 사이 쉬는 시간(멘트·악기 점검 같은 인터벌)을 모두 더해요. 셋리스트에서 곡 시간을 따로 고치면 그 값을 쓰고, 시간이 없는 곡은 합계에서 빼고 몇 곡이 비었는지 따로 알려 줘요.",
  },
  {
    question: "앱 설치가 필요한가요?",
    answer: "아니요. 웹 서비스라 카톡으로 받은 링크를 열면 바로 써요.",
  },
];

export default function LandingFaq() {
  return (
    <div className="border-t border-surface-hover">
      {LANDING_FAQ.map((item, i) => (
        // The first answer starts open; the rest are one tap away and still in the HTML for search engines.
        <details key={item.question} open={i === 0} className="group border-b border-surface-hover">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-body font-semibold text-text [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <svg
              className="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <p className="break-keep pb-4.5 text-body text-text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
