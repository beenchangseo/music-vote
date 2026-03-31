import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "셋리스트 정하는 방법 - Plypick 사용 가이드",
  description:
    "Plypick로 밴드 셋리스트를 투표로 정하는 방법을 단계별로 안내합니다. 플레이리스트 만들기부터 결과 공유까지.",
};

export default function GuidePage() {
  return (
    <main className="min-h-full bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-100 mb-4">
          셋리스트 정하는 방법
        </h1>
        <p className="text-gray-400 mb-8">
          Plypick를 활용한 밴드 셋리스트 투표 가이드
        </p>

        <div className="space-y-10 text-gray-300 leading-relaxed">
          {/* Step 1 */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                1
              </div>
              <h2 className="text-xl font-semibold text-gray-100">
                플레이리스트 만들기
              </h2>
            </div>
            <p>
              홈 화면에서 플레이리스트 이름을 입력합니다.
              밴드 이름, 공연명, 날짜 등을 넣으면 구분하기 쉽습니다.
            </p>
            <p className="mt-2 text-gray-400">
              예시: &quot;락밴드 7월 공연 후보곡&quot;, &quot;2026 여름 합주 셋리스트&quot;
            </p>
            <p className="mt-2">
              투표 마감일을 설정할 수도 있습니다. 합주 전날로 설정하면 효과적입니다.
            </p>
          </section>

          {/* Step 2 */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                2
              </div>
              <h2 className="text-xl font-semibold text-gray-100">
                곡 후보 추가하기
              </h2>
            </div>
            <p>
              YouTube에서 연주하고 싶은 곡을 검색하고, URL을 붙여넣으면 됩니다.
              곡 제목, 아티스트, 썸네일이 자동으로 가져와집니다.
            </p>
            <p className="mt-2 text-gray-400">
              팁: YouTube Music, 일반 YouTube, Shorts URL 모두 지원됩니다.
              누가 추가했는지 표시되므로, 각 멤버가 자유롭게 곡을 추가하세요.
            </p>
          </section>

          {/* Step 3 */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                3
              </div>
              <h2 className="text-xl font-semibold text-gray-100">
                멤버에게 링크 공유
              </h2>
            </div>
            <p>
              플레이리스트를 만들면 공유 링크와 QR 코드가 생성됩니다.
              카카오톡 단톡방에 링크를 보내면 멤버들이 바로 참여할 수 있습니다.
            </p>
            <p className="mt-2 text-gray-400">
              회원가입이 필요 없습니다. 링크를 열고 닉네임만 입력하면 바로 투표할 수 있어요.
            </p>
          </section>

          {/* Step 4 */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                4
              </div>
              <h2 className="text-xl font-semibold text-gray-100">
                투표하기
              </h2>
            </div>
            <p>
              각 곡에 찬성(+1) 또는 반대(-1) 투표를 합니다.
              같은 버튼을 다시 누르면 투표가 취소되고,
              반대 버튼을 누르면 방향이 바뀝니다.
            </p>
            <p className="mt-2">
              곡 목록은 점수순으로 실시간 정렬됩니다.
              카드 보기로 전환하면 YouTube 영상을 바로 재생할 수 있습니다.
            </p>
          </section>

          {/* Step 5 */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                5
              </div>
              <h2 className="text-xl font-semibold text-gray-100">
                결과 확인 및 공유
              </h2>
            </div>
            <p>
              투표가 끝나면 &quot;결과 공유&quot; 버튼으로 결과를 텍스트로 복사할 수 있습니다.
              단톡방에 붙여넣으면 셋리스트 확정 완료.
            </p>
          </section>

          {/* Tips */}
          <section className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-3">
              효과적인 투표를 위한 팁
            </h2>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>• 곡 후보는 10곡 이내로 추리면 투표가 빨라집니다</li>
              <li>• 마감일을 설정하면 미루는 멤버도 참여하게 됩니다</li>
              <li>• 각 멤버가 직접 곡을 추가하면 참여도가 높아집니다</li>
              <li>• 컴팩트 보기로 빠르게 훑고, 카드 보기로 곡을 미리 들어보세요</li>
            </ul>
          </section>

          <section className="text-center">
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-all active:scale-95"
            >
              지금 플레이리스트 만들기
            </Link>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800">
          <a href="/" className="text-sm text-gray-500 hover:text-primary transition-colors">
            &larr; 홈으로 돌아가기
          </a>
        </div>
      </div>
    </main>
  );
}
