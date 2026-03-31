import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 - Plypick",
  description: "Plypick(plypick.kr) 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-full bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-100 mb-8">개인정보처리방침</h1>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">1. 수집하는 개인정보</h2>
            <p>Plypick(이하 &quot;서비스&quot;)는 최소한의 정보만 수집합니다.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>닉네임: 투표 참여 시 사용자가 직접 입력 (필수)</li>
              <li>접속 IP: 서비스 보안 및 악용 방지 목적 (자동 수집)</li>
              <li>쿠키: 사용자 편의를 위한 로컬 저장 (브라우저 localStorage)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">2. 개인정보의 이용 목적</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>투표 서비스 제공 및 중복 투표 방지</li>
              <li>서비스 이용 통계 분석</li>
              <li>서비스 악용 방지 및 보안 유지</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">3. 개인정보의 보유 및 파기</h2>
            <p>
              수집된 닉네임은 플레이리스트 삭제 시 함께 파기됩니다.
              접속 로그는 보안 목적으로 최대 90일간 보관 후 자동 삭제됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">4. 개인정보의 제3자 제공</h2>
            <p>
              서비스는 사용자의 개인정보를 제3자에게 제공하지 않습니다.
              다만, 법령에 따른 요청이 있는 경우 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">5. 광고 서비스</h2>
            <p>
              서비스는 Google AdSense를 통해 광고를 게재할 수 있습니다.
              Google은 광고 제공을 위해 쿠키를 사용할 수 있으며,
              사용자는 Google의 광고 설정 페이지에서 맞춤 광고를 비활성화할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">6. 이용자의 권리</h2>
            <p>
              사용자는 언제든지 자신의 투표 기록에 대해 삭제를 요청할 수 있습니다.
              문의는 서비스 운영자에게 연락해 주세요.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">7. 개인정보 보호책임자</h2>
            <p>
              서비스 운영자: plypick.kr 관리자
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">8. 시행일</h2>
            <p>본 개인정보처리방침은 2026년 3월 31일부터 시행됩니다.</p>
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
