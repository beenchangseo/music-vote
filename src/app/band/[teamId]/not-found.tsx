import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";

/** 없는 밴드 (디자인 리뷰 7A). 초대 링크가 죽은 경우는 /join 쪽 not-found 가 맡는다 (R10). */
export default function BandNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-bg text-text">
      <div className="max-w-sm text-center">
        <h1 className="text-h2 font-bold mb-2">밴드를 찾을 수 없어요</h1>
        <p className="text-sm text-text-muted leading-relaxed mb-7">주소가 바뀌었거나 없어진 밴드예요</p>
        <Link href="/" className={buttonClassName({ size: "md" })}>
          홈으로
        </Link>
      </div>
    </main>
  );
}
