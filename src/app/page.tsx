import HeroCTA from "@/components/HeroCTA";
import DemoVote from "@/components/home/DemoVote";
import DemoPlayback from "@/components/home/DemoPlayback";
import DemoSetlist from "@/components/home/DemoSetlist";
import DemoBand from "@/components/home/DemoBand";
import MyPlaylists from "@/components/MyPlaylists";
import MyBands from "@/components/MyBands";
import LeftBandNotice from "@/components/LeftBandNotice";
import { getCurrentUser } from "@/lib/auth";
import { getMyPlaylists, getHomeStats } from "@/actions/playlist";
import { getMyTeams } from "@/actions/team";

export const revalidate = 600; // 10분마다 통계 갱신

interface HomeProps {
  searchParams: Promise<{ left?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const [user, stats, query] = await Promise.all([
    getCurrentUser(),
    getHomeStats().catch(() => ({ playlists: 0, users: 0, songs: 0 })),
    searchParams,
  ]);
  const loggedIn = !!user;
  // Rooms and bands in one round trip (eng D5).
  const [{ playlists: dbPlaylists }, { teams: myTeams }] = loggedIn
    ? await Promise.all([getMyPlaylists(), getMyTeams()])
    : [{ playlists: [] }, { teams: [] }];

  // Returning users get their own home (Spotify / YouTube Music home): no landing pitch in the way.
  if (user) {
    return (
      <main className="relative isolate min-h-full">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary-soft/60 to-transparent" />
        <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
          {/* 디자인 2회차 6A: once, right after leaving a band. */}
          <LeftBandNotice left={query.left === "1"} />
          <BrandMark />

          <h1 className="mt-10 break-keep text-h1 font-bold leading-snug text-text">
            {user.nickname}님,
            <br />
            다음 합주곡 정해 볼까요?
          </h1>
          <div className="mt-6">
            <HeroCTA loggedIn myTeams={myTeams} compact />
          </div>

          {/* Bands sit right above the playlists (4A). */}
          <MyBands teams={myTeams} />
          <MyPlaylists loggedIn dbPlaylists={dbPlaylists} />
          {dbPlaylists.length === 0 && myTeams.length === 0 && (
            <p className="mt-10 text-sm leading-relaxed text-text-muted">
              새 플레이리스트를 만들고 단톡방에 링크를 보내면, 멤버들이 곡을 올리고 투표해요.
            </p>
          )}

          <nav aria-label="Plypick 안내" className="mt-14 flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-subtle">
            <a href="/guide" className="inline-flex min-h-11 items-center transition-colors hover:text-text-muted">사용 가이드</a>
            <a href="/about" className="inline-flex min-h-11 items-center transition-colors hover:text-text-muted">소개</a>
            <a href="/privacy" className="inline-flex min-h-11 items-center transition-colors hover:text-text-muted">개인정보처리방침</a>
            <a href="/terms" className="inline-flex min-h-11 items-center transition-colors hover:text-text-muted">이용약관</a>
          </nav>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex flex-col">
      {/* HERO — 첫 뷰포트, 후킹 우선 */}
      <section className="relative flex-1 flex flex-col justify-center px-4 pt-10 pb-12 min-h-[88vh] overflow-hidden">
        {/* Animated gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/25 via-bg to-indigo-900/25 animate-gradient pointer-events-none" />


        <div className="relative z-10 w-full max-w-md mx-auto">
          {/* 디자인 2회차 6A: once, right after leaving a band. */}
          <LeftBandNotice left={query.left === "1"} />
          {/* 작은 브랜드 마크 */}
          <div className="mb-10">
            <BrandMark />
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
              Plypick에서 5분안에 끝내요.
            </p>
          </div>

          {/* CTA */}
          <HeroCTA loggedIn={loggedIn} myTeams={myTeams} />
          {!loggedIn && (
            <p className="mt-3 text-center text-caption text-text-subtle">
              카카오로 3초면 시작 · 멤버도 로그인 한 번이면 참여
            </p>
          )}

          {/* Social proof strip — 결정 직전 신뢰 (조용한 네온, 펄스 없음) */}
          {(stats.playlists > 0 || stats.songs > 0 || stats.users > 0) && (
            <p className="mt-6 text-center text-caption text-text-muted tabular-nums">
              플레이리스트 <strong className="font-bold text-primary">{stats.playlists.toLocaleString()}</strong>
              <span className="mx-1.5 text-text-subtle/50" aria-hidden>·</span>
              멤버 <strong className="font-bold text-primary">{stats.users.toLocaleString()}</strong>
              <span className="mx-1.5 text-text-subtle/50" aria-hidden>·</span>
              곡 <strong className="font-bold text-primary">{stats.songs.toLocaleString()}</strong>
            </p>
          )}

          {/* Returning user shortcut. Bands sit right above the rooms (4A). */}
          <MyBands teams={myTeams} />
          <MyPlaylists loggedIn={loggedIn} dbPlaylists={dbPlaylists} />
        </div>
      </section>

      {/* DEMO 1 — 투표 실시간 정렬 */}
      <section className="px-4 py-12 bg-surface/30 border-y border-border/50">
        <div className="max-w-md mx-auto">
          <DemoVote />
        </div>
      </section>

      {/* DEMO 2 — 재생 */}
      <section className="px-4 py-12">
        <div className="max-w-md mx-auto">
          <DemoPlayback />
        </div>
      </section>

      {/* DEMO 3 — 셋리스트 인터벌 */}
      <section className="px-4 py-12 bg-surface/30 border-y border-border/50">
        <div className="max-w-md mx-auto">
          <DemoSetlist />
        </div>
      </section>

      {/* DEMO 4 — 합주: 키·BPM·메트로놈·코멘트 (진짜 차별점) */}
      <section className="px-4 py-12">
        <div className="max-w-md mx-auto">
          <DemoBand />
        </div>
      </section>

      {/* PAIN → 해소 — 흩어진 채팅 맥락을 곡마다 한곳에 */}
      <section className="px-4 py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-h3 font-bold text-text mb-5 text-center leading-snug">
            채팅방 거슬러 올라가는 거,<br />이제 그만
          </h2>

          {/* 카톡에서 묻혀 매번 다시 찾던 정보 — 흐릿한 인용 */}
          <div className="space-y-2 mb-4">
            {[
              "기타는 이 곡을 왜 반대한다고 했더라…?",
              "보컬이 몇 키 낮추자고 했더라…?",
            ].map((q) => (
              <p
                key={q}
                className="text-sm text-text-subtle italic pl-3 border-l-2 border-border"
              >
                “{q}”
              </p>
            ))}
          </div>
          <p className="text-sm text-text-muted text-center mb-8 leading-relaxed">
            카톡 채팅방을 한참 올려다보며 확인하던 정보,
            <br />
            <strong className="text-text font-semibold">Plypick은 곡마다 한곳에</strong> 모아둬요.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 items-stretch">
            {/* Before — 단톡방 */}
            <div className="rounded-2xl bg-surface border border-border p-4">
              <span className="inline-block text-caption font-bold uppercase tracking-wider text-text-subtle mb-3">
                Before · 단톡방
              </span>
              <ul className="space-y-2.5">
                {[
                  "“뭐 칠까” 한참 떠들다 흐지부지",
                  "왜 그 곡 골랐는지 스크롤 한참 위",
                  "낮추기로 한 키, 메시지 속에 증발",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-text-muted">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-text-subtle" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="leading-snug">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After — Plypick */}
            <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4">
              <span className="inline-block text-caption font-bold uppercase tracking-wider text-primary mb-3">
                After · Plypick
              </span>
              <ul className="space-y-2.5">
                {[
                  "후보마다 점수·의견 한눈에",
                  "투표하면 점수순 자동 정렬",
                  "키·코멘트가 곡에 딱 붙어요",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-text">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="leading-snug font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 마지막 CTA */}
      <section className="px-4 pb-16">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-indigo-600/10 border border-primary/30 p-6 text-center">
            <p className="text-sm text-text mb-4">
              지금 첫 플레이리스트, 5분이면 시작.
            </p>
            <HeroCTA loggedIn={loggedIn} myTeams={myTeams} />
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

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-600 shadow-lg shadow-primary/30">
        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
          />
        </svg>
      </div>
      <span className="text-base font-bold text-text">Plypick</span>
    </div>
  );
}
