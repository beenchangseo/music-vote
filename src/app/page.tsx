import HeroCTA from "@/components/HeroCTA";
import LivePreview from "@/components/LivePreview";
import MyPlaylists from "@/components/MyPlaylists";
import { getCurrentUser } from "@/lib/auth";
import { getMyPlaylists } from "@/actions/playlist";

export default async function Home() {
  const user = await getCurrentUser();
  const loggedIn = !!user;
  const dbPlaylists = loggedIn ? await getMyPlaylists() : [];
  return (
    <main className="min-h-full flex flex-col">
      {/* HERO — 첫 뷰포트, 후킹 우선 */}
      <section className="relative flex-1 flex flex-col justify-center px-4 pt-10 pb-12 min-h-[88vh] overflow-hidden">
        {/* Animated gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/25 via-bg to-indigo-900/25 animate-gradient pointer-events-none" />

        {/* Floating notes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[14%] left-[8%] text-3xl opacity-10 animate-float-slow">
            &#9835;
          </div>
          <div className="absolute top-[22%] right-[10%] text-2xl opacity-10 animate-float-mid">
            &#9834;
          </div>
          <div className="absolute bottom-[18%] left-[14%] text-4xl opacity-[0.06] animate-float-fast">
            &#9833;
          </div>
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto">
          {/* 작은 브랜드 마크 */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                />
              </svg>
            </div>
            <span className="text-base font-bold text-text">Plypick</span>
          </div>

          {/* Hook */}
          <div className="mb-8">
            <p className="text-caption font-semibold text-primary uppercase tracking-wider mb-3">
              밴드 곡 투표
            </p>
            <h1 className="text-display font-bold text-text leading-[1.15] tracking-tight">
              다음 합주곡,<br />
              <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
                5분 컷.
              </span>
            </h1>
            <p className="mt-5 text-base text-text-muted leading-relaxed">
              단톡방에서 미루던 곡 결정,<br />
              멤버 5명이 5분 안에 끝내요.
            </p>
          </div>

          {/* CTA */}
          <HeroCTA loggedIn={loggedIn} />

          {/* Returning user shortcut */}
          <MyPlaylists loggedIn={loggedIn} dbPlaylists={dbPlaylists} />
        </div>
      </section>

      {/* LIVE PREVIEW — 가입 전 시각 증거 */}
      <section className="px-4 py-12 bg-surface/30 border-y border-border/50">
        <div className="max-w-md mx-auto">
          <LivePreview />
        </div>
      </section>

      {/* 3-STEP — 짧게 */}
      <section className="px-4 py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-h3 font-bold text-text mb-6 text-center">
            이렇게 끝내요
          </h2>
          <ol className="space-y-3">
            {[
              { n: "1", t: "이름 정하기", d: "1초" },
              { n: "2", t: "YouTube 링크 붙이기", d: "곡 정보 자동" },
              { n: "3", t: "카톡으로 멤버 초대", d: "가입 없이 투표" },
            ].map((s) => (
              <li
                key={s.n}
                className="flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border"
              >
                <span className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold shrink-0">
                  {s.n}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text">{s.t}</div>
                  <div className="text-caption text-text-muted mt-0.5">
                    {s.d}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 마지막 CTA */}
      <section className="px-4 pb-16">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-indigo-600/10 border border-primary/30 p-6 text-center">
            <p className="text-sm text-text mb-4">
              지금 첫 플레이리스트, 5분이면 시작.
            </p>
            <HeroCTA loggedIn={loggedIn} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-6 text-center text-caption text-text-subtle">
        <p>Plypick &mdash; 밴드를 위한 곡 투표 서비스</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <a href="/about" className="hover:text-text-muted transition-colors">
            소개
          </a>
          <span aria-hidden>·</span>
          <a href="/guide" className="hover:text-text-muted transition-colors">
            사용 가이드
          </a>
          <span aria-hidden>·</span>
          <a href="/privacy" className="hover:text-text-muted transition-colors">
            개인정보처리방침
          </a>
          <span aria-hidden>·</span>
          <a href="/terms" className="hover:text-text-muted transition-colors">
            이용약관
          </a>
        </div>
      </footer>
    </main>
  );
}
