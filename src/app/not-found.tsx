import Link from "next/link";

// Next 16 자동 _not-found 프리렌더 이슈를 명시적 페이지로 우회.
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-bg text-text">
      <div className="max-w-sm text-center">
        <p className="text-caption font-bold text-primary uppercase tracking-wider mb-2">
          404
        </p>
        <h1 className="text-h1 font-bold mb-2">페이지를 찾을 수 없어요</h1>
        <p className="text-sm text-text-muted leading-relaxed mb-7">
          링크가 만료되었거나 잘못된 주소일 수 있어요.<br />
          홈에서 플레이리스트를 새로 만들거나 멤버에게 받은 링크를 다시 확인해주세요.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-all active:scale-[0.97]"
        >
          홈으로 →
        </Link>
      </div>
    </main>
  );
}
