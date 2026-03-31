import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 - Plypick",
  description: "Plypick(plypick.kr) 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main className="min-h-full bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-100 mb-8">이용약관</h1>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제1조 (목적)</h2>
            <p>
              본 약관은 Plypick(이하 &quot;서비스&quot;)의 이용 조건 및 절차,
              이용자와 서비스 운영자의 권리와 의무를 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제2조 (서비스의 내용)</h2>
            <p>서비스는 다음의 기능을 제공합니다.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>플레이리스트 생성 및 관리</li>
              <li>YouTube 곡 추가 및 미리보기</li>
              <li>밴드 구성원 간 곡 투표</li>
              <li>투표 결과 공유</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제3조 (이용자의 의무)</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>타인의 닉네임을 도용하여 투표하지 않아야 합니다.</li>
              <li>서비스를 악용하여 대량의 플레이리스트나 곡을 생성하지 않아야 합니다.</li>
              <li>서비스의 정상적인 운영을 방해하는 행위를 하지 않아야 합니다.</li>
              <li>관련 법령 및 본 약관의 규정을 준수해야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제4조 (서비스의 변경 및 중단)</h2>
            <p>
              운영자는 서비스 개선을 위해 사전 고지 없이 서비스 내용을 변경할 수 있습니다.
              천재지변, 시스템 장애 등 불가항력의 경우 서비스가 일시적으로 중단될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제5조 (면책 조항)</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>서비스는 무료로 제공되며, 서비스 이용으로 발생하는 손해에 대해 책임지지 않습니다.</li>
              <li>이용자가 게시한 콘텐츠(YouTube 링크, 닉네임 등)에 대한 책임은 해당 이용자에게 있습니다.</li>
              <li>서비스에 게재된 광고의 내용에 대한 책임은 광고주에게 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제6조 (저작권)</h2>
            <p>
              서비스에 추가되는 YouTube 콘텐츠의 저작권은 원 저작권자에게 있습니다.
              서비스는 YouTube oEmbed API를 통해 공개된 메타데이터만 활용합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">제7조 (분쟁 해결)</h2>
            <p>
              서비스 이용과 관련한 분쟁은 대한민국 법률에 따라 해결합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">부칙</h2>
            <p>본 약관은 2026년 3월 31일부터 시행됩니다.</p>
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
