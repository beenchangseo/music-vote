import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "밴드 투표 서비스란? - Music Vote",
  description:
    "밴드 곡 투표 서비스 Music Vote(plypick.kr)를 소개합니다. 밴드 멤버들과 다음 공연 셋리스트를 투표로 정하세요.",
};

export default function AboutPage() {
  return (
    <main className="min-h-full bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-100 mb-4">
          밴드 투표 서비스란?
        </h1>
        <p className="text-gray-400 mb-8">
          밴드 셋리스트, 아직도 단톡방에서 정하고 계신가요?
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-100 mb-3">
              셋리스트 정하기, 왜 어려울까?
            </h2>
            <p>
              밴드 활동에서 가장 많이 반복되는 논의 중 하나가 &quot;다음에 뭐 치지?&quot;입니다.
              카카오톡이나 밴드 단톡방에서 곡 후보를 던지고, 각자 의견을 말하고,
              결국 목소리 큰 사람 의견대로 정해지는 경우가 많습니다.
            </p>
            <p className="mt-2">
              모든 멤버의 의견을 공평하게 반영하고, 곡을 미리 들어보면서
              투표할 수 있다면 어떨까요?
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-100 mb-3">
              Music Vote가 해결합니다
            </h2>
            <p>
              Music Vote(plypick.kr)는 밴드 멤버들이 다음 공연이나 합주에서 연주할 곡을
              투표로 선정할 수 있는 무료 웹 서비스입니다.
            </p>
            <ul className="mt-4 space-y-3">
              {[
                {
                  title: "YouTube로 바로 확인",
                  desc: "곡 후보를 YouTube URL로 추가하면, 제목과 썸네일이 자동으로 불러와집니다. 투표 전에 곡을 미리 들어볼 수 있어요.",
                },
                {
                  title: "공평한 투표",
                  desc: "모든 멤버가 1인 1표로 찬성/반대 투표를 합니다. 점수순으로 자동 정렬되어 결과가 명확합니다.",
                },
                {
                  title: "링크 하나로 시작",
                  desc: "회원가입 없이, 닉네임만 입력하면 바로 참여할 수 있습니다. 카카오톡으로 링크를 공유하면 끝.",
                },
                {
                  title: "마감일 설정",
                  desc: "합주 전날까지 투표를 마감하면, 합주 당일에는 연습에만 집중할 수 있습니다.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                  <div>
                    <span className="font-medium text-gray-100">{item.title}</span>
                    <span className="text-gray-400"> — {item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-100 mb-3">
              이런 분들께 추천합니다
            </h2>
            <ul className="space-y-2 text-gray-400">
              <li>• 공연이나 합주 셋리스트를 매번 톡방에서 정하는 밴드</li>
              <li>• 멤버 의견을 공평하게 반영하고 싶은 밴드 리더</li>
              <li>• 곡을 미리 들어보고 투표하고 싶은 밴드 멤버</li>
              <li>• 동아리, 학교 밴드부, 교회 찬양팀 등 음악 그룹</li>
            </ul>
          </section>

          <section className="bg-surface border border-border rounded-2xl p-6 text-center">
            <p className="text-lg font-semibold text-gray-100 mb-2">
              지금 바로 시작하세요
            </p>
            <p className="text-sm text-gray-400 mb-4">
              무료, 회원가입 없이, 30초면 플레이리스트를 만들 수 있습니다.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-all active:scale-95"
            >
              플레이리스트 만들기
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
