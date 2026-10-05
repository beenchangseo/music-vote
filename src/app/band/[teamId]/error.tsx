"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button, { buttonClassName } from "@/components/ui/Button";

/** 밴드 홈 조회 실패 (디자인 리뷰 7A). Next 16 의 에러 경계는 `reset` 이 아니라 `unstable_retry` 를 받는다. */
export default function BandError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[band] 밴드 홈을 불러오지 못했어요", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-bg text-text">
      <div className="max-w-sm text-center">
        <h1 className="text-h2 font-bold mb-2">밴드를 불러오지 못했어요</h1>
        <p className="text-sm text-text-muted leading-relaxed mb-7">잠시 후 다시 시도해 주세요</p>
        <div className="flex flex-col items-center gap-2">
          <Button onClick={() => unstable_retry()}>다시 시도</Button>
          <Link href="/" className={buttonClassName({ variant: "ghost", size: "md" })}>
            홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
