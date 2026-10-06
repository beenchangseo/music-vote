/**
 * 로그인 홈의 뼈대 화면 (DR10). 로그인 쿠키가 있으면 홈이 바로 이걸 보내고, 로그인 확인과 목록 조회는
 * 뒤에서 한다(eng O4). 상태 A/B 는 아직 모르므로 버튼 줄은 높이만 잡는다.
 * 루트 loading.tsx 가 아니라 홈의 Suspense 에만 걸려 다른 경로와 404 상태 코드에 영향이 없다.
 */
export default function HomeSkeleton() {
  return (
    <main className="relative isolate min-h-full" aria-busy="true">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary-soft/60 to-transparent" />
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <p role="status" className="sr-only">
          홈을 불러오는 중이에요
        </p>
        <div aria-hidden className="motion-safe:animate-pulse-soft">
          <div className="h-8 w-28 rounded-lg bg-surface" />
          <div className="mt-10 h-7 w-3/4 rounded-lg bg-surface" />
          <div className="mt-2 h-7 w-1/2 rounded-lg bg-surface" />
          <div className="mt-6 h-12 w-full rounded-pill bg-surface" />
          <div className="mt-10 h-6 w-32 rounded-lg bg-surface" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-16 rounded-control bg-surface" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
