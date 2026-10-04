import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";

/**
 * 없는 초대 코드·새로 만들어서 죽은 옛 링크 (디자인 리뷰 7A).
 * 로그인한 사람에게는 이미 멤버일 수 있으니 "내 밴드" 로 가는 길을 한 줄 더 준다 (디자인 2회차 4A).
 * 죽은 코드는 어느 밴드도 가리키지 않으므로 밴드 홈으로 바로 보내지 않는다.
 */
export default async function JoinNotFound() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-bg text-text">
      <div className="max-w-sm text-center">
        <h1 className="text-h2 font-bold mb-2">이 초대 링크는 더 이상 쓸 수 없어요</h1>
        <p className="text-sm text-text-muted leading-relaxed mb-7">밴드 멤버에게 새 링크를 받아 주세요</p>
        <Link href="/" className={buttonClassName({ size: "md", variant: user ? "secondary" : "primary" })}>
          홈으로
        </Link>
        {user && (
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              이미 멤버라면 홈의 &lsquo;내 밴드&rsquo;에서 들어갈 수 있어요
            </p>
            <Link href="/#my-bands" className={buttonClassName({ size: "md" })}>
              내 밴드 보기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
