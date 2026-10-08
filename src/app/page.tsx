import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import HeroCTA from "@/components/HeroCTA";
import HomeSkeleton from "@/components/HomeSkeleton";
import LandingVoteDemo from "@/components/home/LandingVoteDemo";
import LandingSetlistPoster from "@/components/home/LandingSetlistPoster";
import { LandingShareChat, LandingShareSteps } from "@/components/home/LandingShareCard";
import LandingFaq, { LANDING_FAQ } from "@/components/home/LandingFaq";
import MyPlaylists from "@/components/MyPlaylists";
import MyBands from "@/components/MyBands";
import LeftBandNotice from "@/components/LeftBandNotice";
import { HomeBandCard } from "@/components/BandPromptCard";
import { buttonClassName } from "@/components/ui/Button";
import type { BandCandidate } from "@/components/CreateBandSheet";
import { getCurrentUser, hasAuthCookie } from "@/lib/auth";
import { BAND_PROMPT_COOKIE, parseDismissals } from "@/lib/prompt-dismissals";
import { getMyPlaylists, type MyPlaylistDbEntry } from "@/actions/playlist";
import { getMyTeams } from "@/actions/team";
import { HOME_DESCRIPTION, HOME_TITLE, homeJsonLd, jsonLdScript } from "@/lib/seo";

// `?left=1` and other query variants are the same page.
export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
};

interface HomeProps {
  searchParams: Promise<{ left?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const [cookieStore, query] = await Promise.all([cookies(), searchParams]);
  const left = query.left === "1";

  // No login cookie: the landing, at once. With one, the skeleton goes out before the
  // Supabase Auth check and the list lookups run behind it (DR10, eng O4).
  if (!hasAuthCookie(cookieStore.getAll().map((cookie) => cookie.name))) {
    return <Landing left={left} />;
  }
  const dismissals = parseDismissals(cookieStore.get(BAND_PROMPT_COOKIE)?.value);
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <SignedInHome left={left} dismissals={dismissals} />
    </Suspense>
  );
}

/** 새 밴드 시트의 "같이 투표한 멤버로 만들기" 대상 (DR3): 내가 방장 · 밴드 없음 · 로그인 멤버 ≥ 2. 최근 것부터. */
function bandCandidates(playlists: MyPlaylistDbEntry[]): BandCandidate[] {
  return playlists
    .filter((playlist) => playlist.isMine && !playlist.teamId && playlist.memberCount >= 2)
    .map(({ id, title, memberCount, memberPreview }) => ({ id, title, memberCount, memberPreview }));
}

async function SignedInHome({
  left,
  dismissals,
}: {
  left: boolean;
  /** Playlists whose band card was closed (DR6 cookie). */
  dismissals: string[];
}) {
  const user = await getCurrentUser();
  // The cookie outlived the session.
  if (!user) return <Landing left={left} />;

  // Rooms and bands in one round trip (eng D5).
  const [playlistsResult, teamsResult] = await Promise.all([getMyPlaylists(), getMyTeams()]);
  const failed = playlistsResult.failed || teamsResult.failed;
  const dbPlaylists = playlistsResult.playlists;
  const myTeams = teamsResult.teams;
  const empty = dbPlaylists.length === 0 && myTeams.length === 0;
  // State A only for a real 0/0 (DR2). A failed lookup (DR7) and a band just left (DR15) stay in B.
  const variant = !failed && !left && empty ? "start" : "row";
  const candidates = bandCandidates(dbPlaylists);
  // Home card (DR4 · DR5): only for someone with no band yet, only the newest candidate. Once that one is
  // closed there is no card, even if older candidates exist; a newer candidate brings it back.
  const cardTarget = !failed && myTeams.length === 0 ? (candidates[0] ?? null) : null;
  const showCard = cardTarget !== null && !dismissals.includes(cardTarget.id);

  return (
    <main className="relative isolate min-h-full">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary-soft/60 to-transparent" />
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        {/* 디자인 2회차 6A: once, right after leaving a band. */}
        <LeftBandNotice left={left} />
        <BrandMark />

        <h1 className="mt-10 break-keep text-h1 font-bold leading-snug text-text">
          {user.nickname}님,
          <br />
          {variant === "start" ? "어떻게 시작할까요?" : "다음 합주곡 정해 볼까요?"}
        </h1>
        <div className="mt-6">
          <HeroCTA
            variant={variant}
            myTeams={myTeams}
            bandCandidates={candidates}
            // DR11: the newest band-less playlist I only take part in.
            participantOnlyTitle={dbPlaylists.find((playlist) => !playlist.isMine && !playlist.teamId)?.title ?? null}
          />
        </div>
        {/* DR6: drawn by the server under the button row, so it never pops in after load. */}
        {showCard && <HomeBandCard candidate={cardTarget} dismissed={false} />}

        {failed ? (
          <section aria-labelledby="home-load-error" className="mt-10 rounded-card border border-border bg-surface p-4">
            {/* The skeleton announced loading; a failure that replaces it has to be announced too. */}
            <p id="home-load-error" role="alert" className="text-sm text-text">
              목록을 불러오지 못했어요
            </p>
            {/* The home is dynamic, so navigating to it again reads the lists again. */}
            <Link href="/" prefetch={false} className={buttonClassName({ variant: "secondary", className: "mt-3 min-h-11" })}>
              다시 불러오기
            </Link>
          </section>
        ) : (
          <>
            {/* Bands sit right above the playlists (4A). In state A only playlists kept on this device show (DR15). */}
            <MyBands teams={myTeams} />
            <MyPlaylists loggedIn dbPlaylists={dbPlaylists} />
            {variant === "row" && empty && (
              <p className="mt-10 text-sm leading-relaxed text-text-muted">
                새 플레이리스트를 만들고 단톡방에 링크를 보내면, 멤버들이 곡을 올리고 투표해요.
              </p>
            )}
          </>
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

const COMPARE_ROWS = [
  ["곡 모으기", "위로 스크롤", "한 목록"],
  ["의견", "말 많은 사람 순", "찬성·반대 투표"],
  ["결정", "방장 혼자 정리", "점수순 정렬"],
  ["공연 길이", "따로 계산", "쉬는 시간까지 합계"],
  ["합주 날", "링크 다시 찾기", "셋리스트 그대로"],
] as const;

const SECTION_TITLE = "break-keep text-h2 font-bold text-text lg:text-h1";
const SECTION_LEAD = "mt-2.5 max-w-xl break-keep text-body text-text-muted lg:text-h4 lg:font-normal";

/**
 * 로그아웃 랜딩. 로그인 쿠키가 없거나 세션이 끝난 사람. 검색엔진이 읽는 화면이라 모든 글이 서버
 * HTML 로 나가고, 섹션 제목마다 사람들이 검색하는 말(밴드·곡 투표·합주곡·셋리스트)이 들어간다.
 * 휴대폰은 한 줄, 넓은 화면은 2단(디자인 캔버스 L11 · D3).
 */
function Landing({ left }: { left: boolean }) {
  return (
    <main className="min-h-full">
      {/* Structured data for search engines. Only the landing: the signed-in home is personal. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(homeJsonLd(LANDING_FAQ)) }} />
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6 lg:max-w-6xl lg:px-6">
        {/* 디자인 2회차 6A: once, right after leaving a band. */}
        <LeftBandNotice left={left} />
        <BrandMark />

        <div className="mt-10 flex flex-col gap-16 lg:mt-16 lg:flex-row lg:items-center">
          <section aria-labelledby="hero-title" className="lg:flex-1">
            <p className="text-caption font-semibold tracking-wider text-primary">밴드 곡 투표</p>
            {/* The space before <br> keeps "합주곡, 투표로" two words for search engines. */}
            <h1 id="hero-title" className="mt-3 break-keep text-display font-bold text-text">
              밴드 합주곡,{" "}
              <br />
              투표로 5분 컷
            </h1>
            <p className="mt-5 max-w-lg break-keep text-body text-text-muted lg:text-h4 lg:font-normal">
              단톡방에 흩어진 후보곡을 링크 하나에 모아 투표하고, 표 많이 받은 곡으로 공연 셋리스트까지 정해요.
            </p>
            <div className="mt-8 lg:max-w-xs">
              <HeroCTA variant="landing" />
              <p className="mt-3 text-center text-caption text-text-subtle">멤버도 카카오 로그인 한 번이면 참여해요</p>
            </div>
          </section>

          <section aria-labelledby="vote-title" className="lg:max-w-[500px] lg:flex-1">
            <h2 id="vote-title" className="break-keep text-h2 font-bold text-text">
              누르는 순간 순위가 바뀌어요
            </h2>
            <p className="mt-2.5 break-keep text-body text-text-muted">
              밴드 멤버가 후보곡에 찬성·반대를 누르면 곡 목록이 점수순으로 바로 다시 정렬돼요. 멤버 넷이 이미 투표한
              예시예요. 직접 눌러 보세요.
            </p>
            <div className="mt-5">
              <LandingVoteDemo />
            </div>
            <p className="mt-3 text-center text-caption text-text-subtle">진짜 플레이리스트에선 멤버 표가 실시간으로 들어와요</p>
          </section>
        </div>

        {/* Phones: heading, poster, features. Wide: poster left, heading and features right. */}
        <section aria-labelledby="setlist-title" className="mt-16 grid gap-y-5 lg:mt-28 lg:grid-cols-2 lg:gap-x-16">
          <div className="lg:col-start-2 lg:row-start-1 lg:self-end">
            <h2 id="setlist-title" className={SECTION_TITLE}>
              투표가 끝나면 셋리스트가 나와요
            </h2>
            <p className={SECTION_LEAD}>표 많이 받은 곡부터 공연 순서를 짜고, 곡 사이 쉬는 시간까지 더해 총 공연 길이를 맞춰요.</p>
          </div>
          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center">
            <LandingSetlistPoster />
          </div>
          <ul className="mt-3 flex flex-col gap-5 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:self-start">
            <LandingFeature
              title="총 공연 시간을 자동으로 더해요"
              body="곡 시간에 멘트·악기 점검 같은 쉬는 시간을 더해서 보여 줘요. 30분 무대에 몇 곡이 들어가는지 바로 알 수 있어요."
              icon={<path d="M12 9v4l2 2M9 2h6M20 13a8 8 0 11-16 0 8 8 0 0116 0z" />}
            />
            <LandingFeature
              title="셋리스트 이미지 저장·PDF 인쇄"
              body="확정한 셋리스트는 한 장짜리 이미지로 단톡방에 올리거나, PDF로 뽑아 합주실과 무대에 들고 가요."
              icon={<path d="M6 9V3h12v6M5 17H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-1M7 14h10v7H7z" />}
            />
          </ul>
        </section>

        {/* Phones: heading, chat, steps. Wide: heading and steps left, chat right. */}
        <section aria-labelledby="share-title" className="mt-16 grid gap-y-5 lg:mt-28 lg:grid-cols-2 lg:gap-x-16">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <h2 id="share-title" className={SECTION_TITLE}>
              멤버는 카톡 카드만 누르면 돼요
            </h2>
            <p className={SECTION_LEAD}>
              플레이리스트 링크를 단톡방에 보내면 이런 카드가 올라가요. 앱 설치도, 회원가입 양식도 없어요.
            </p>
          </div>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <LandingShareChat />
          </div>
          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            <LandingShareSteps />
            <p className="mt-4 break-keep text-sm text-text-muted">닉네임·프로필은 카카오에서 가져와요. 따로 적을 칸이 없어요.</p>
          </div>
        </section>

        <section aria-labelledby="compare-title" className="mt-16 lg:mt-28">
          <h2 id="compare-title" className={SECTION_TITLE}>
            단톡방 vs 플레이리스트
          </h2>
          <p className={SECTION_LEAD}>같은 합주곡 후보를 두 곳에서 정해 보면 이렇게 달라요.</p>
          <div className="mt-5 overflow-x-auto lg:max-w-3xl">
            <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden break-keep rounded-card border border-surface-hover text-sm">
              <thead>
                <tr className="bg-surface text-caption text-text-muted">
                  <th scope="col" className="px-3 py-2.5 text-left font-bold">
                    <span className="sr-only">항목</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-bold">
                    단톡방
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-bold text-text">
                    플레이리스트
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([label, chat, playlist]) => (
                  <tr key={label}>
                    <th scope="row" className="border-t border-surface-hover p-3 text-left font-bold text-text">
                      {label}
                    </th>
                    <td className="border-t border-surface-hover p-3 text-text-muted">{chat}</td>
                    <td className="border-t border-surface-hover p-3 text-text">{playlist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="faq-title"
          className="mt-16 lg:mt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16"
        >
          <h2 id="faq-title" className={SECTION_TITLE}>
            자주 묻는 질문
          </h2>
          <div className="mt-4 lg:mt-0">
            <LandingFaq />
          </div>
        </section>

        <section aria-labelledby="cta-title" className="mt-16 lg:mx-auto lg:mt-28 lg:max-w-md">
          <div className="rounded-card border border-border bg-surface p-6 text-center">
            <h2 id="cta-title" className="break-keep text-h2 font-bold text-text">
              다음 공연 셋리스트,{" "}
              <br />
              투표로 정해요
            </h2>
            <p className="mt-2 break-keep text-sm text-text-muted">카카오 로그인 한 번이면 첫 플레이리스트를 바로 만들어요.</p>
            <div className="mt-5">
              <HeroCTA variant="landing" />
            </div>
          </div>
          {/* Keyword anchor text for the two pages search engines should reach next. */}
          <nav aria-label="더 알아보기" className="mt-4 flex flex-col">
            {[
              { href: "/guide", label: "셋리스트 정하는 방법 보기" },
              { href: "/about", label: "밴드 곡 투표 서비스 소개" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex min-h-12 items-center justify-between gap-3 border-b border-surface-hover text-body font-semibold text-primary transition-colors last:border-b-0 hover:text-text"
              >
                {link.label}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </a>
            ))}
          </nav>
        </section>
      </div>

      <footer className="border-t border-surface-hover">
        <div className="mx-auto flex w-full max-w-md flex-col gap-1.5 px-4 pb-9 pt-7 lg:max-w-6xl lg:px-6">
          <p className="text-sm text-text-subtle">Plypick · 밴드 곡 투표</p>
          <nav aria-label="Plypick 안내" className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { href: "/guide", label: "사용 가이드" },
              { href: "/about", label: "소개" },
              { href: "/privacy", label: "개인정보처리방침" },
              { href: "/terms", label: "이용약관" },
            ].map((link) => (
              <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-sm text-text-subtle transition-colors hover:text-text-muted">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}

function LandingFeature({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-soft text-text">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <div className="min-w-0">
        <h3 className="text-h4 font-bold text-text">{title}</h3>
        <p className="mt-1 break-keep text-sm text-text-muted">{body}</p>
      </div>
    </li>
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
