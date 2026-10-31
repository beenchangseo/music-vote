import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "개인정보처리방침 - Plypick",
  description: "Plypick(plypick.kr) 개인정보처리방침",
});

export default function PrivacyPage() {
  return (
    <main className="min-h-full bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-text mb-8">개인정보처리방침</h1>

        <div className="space-y-6 text-text-muted text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-text mb-2">1. 수집하는 개인정보</h2>
            <p>Plypick(이하 &quot;서비스&quot;)는 서비스에 꼭 필요한 정보만 받아요.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>
                카카오 로그인 정보: 카카오 회원번호, 닉네임, 프로필 사진, 카카오계정 이메일(동의한 경우).
                닉네임과 프로필 사진은 카카오에서 가져오고 따로 입력받지 않아요.
              </li>
              <li>
                서비스를 쓰며 남기는 기록: 만든 플레이리스트와 셋리스트, 추가한 후보곡과 다른 버전, 투표, 댓글,
                플레이리스트·밴드 참여 기록. 기록에는 계정과 그때의 닉네임이 함께 저장돼요.
              </li>
              <li>
                자동으로 생기는 정보: 로그인 유지 쿠키, 브라우저 저장소(만든 플레이리스트 목록, 닫은 안내), 접속 IP,
                이용 통계
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">2. 개인정보의 이용 목적</h2>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>카카오 로그인과 본인 확인 (투표권, 방장 권한, 내가 추가한 곡 관리)</li>
              <li>플레이리스트·투표·셋리스트 제공과 함께 쓰는 멤버에게 닉네임 표시</li>
              <li>서비스 악용 방지 (짧은 시간 안의 요청 횟수 제한)</li>
              <li>서비스 이용 통계</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">3. 개인정보의 보유 및 파기</h2>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>탈퇴하기 전까지 보관해요.</li>
              <li>탈퇴하면 카카오 로그인 정보, 투표, 댓글, 플레이리스트·밴드 참여 기록을 바로 지워요.</li>
              <li>
                추가한 후보곡과 다른 버전, 만든 플레이리스트와 셋리스트, 만든 밴드는 다른 멤버와 함께 쓰는 기록이라
                남겨요. 여기에 적힌 이름은 &quot;탈퇴한 멤버&quot;로 바꾸고 계정과의 연결을 끊어요. 만든 플레이리스트는
                방장이 없는 보관 플레이리스트가 돼요.
              </li>
              <li>플레이리스트를 지우면 그 안의 후보곡, 투표, 댓글, 셋리스트도 함께 지워져요.</li>
              <li>
                접속 IP 는 요청 횟수 제한에 잠깐 쓰고 서비스 기록에는 저장하지 않아요. 로그인 보안 기록(접속 IP, 로그인
                시각)은 로그인 서비스(Supabase)가 따로 남기고, 탈퇴 뒤에도 남을 수 있어요.
              </li>
              <li>
                이용 통계와 성능 측정(Vercel)은 쿠키 없이 모으고 개인을 알아볼 수 없는 통계로만 봐요. 페이지 주소,
                투표·곡 추가 같은 사용 기록, 브라우저와 기기 종류, 대략적인 지역이 들어가요.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">4. 개인정보의 제3자 제공과 처리 위탁</h2>
            <p>
              서비스는 사용자의 개인정보를 제3자에게 제공하지 않아요.
              다만, 법령에 따른 요청이 있는 경우 예외로 해요.
            </p>
            <p className="mt-2">서비스 운영을 위해 아래 회사에 처리를 맡겨요.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>Supabase: 데이터베이스와 로그인</li>
              <li>Vercel: 서비스 호스팅과 이용 통계</li>
              <li>카카오: 카카오 로그인과 카카오톡 공유</li>
              <li>YouTube(Google): 후보곡 영상 재생과 검색</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">5. 이용자의 권리와 탈퇴</h2>
            <p>
              언제든지 탈퇴할 수 있어요. 프로필 사진을 눌러 여는 로그인 메뉴에서 &quot;탈퇴하기&quot;를 누르면 바로
              탈퇴돼요. 탈퇴하지 않고 기록만 지우려면 투표는 다시 눌러 취소하고, 댓글과 직접 추가한 후보곡은 직접 지울
              수 있어요. 보관된 플레이리스트에서는 기록을 지울 수 없고, 탈퇴하면 그곳의 투표와 댓글도 지워져요.
            </p>
            <p className="mt-2">문의는 서비스 운영자에게 연락해 주세요.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">6. 개인정보 보호책임자</h2>
            <p>
              서비스 운영자: plypick.kr 관리자
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">7. 시행일</h2>
            <p>본 개인정보처리방침은 2026년 3월 31일부터 시행돼요.</p>
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
