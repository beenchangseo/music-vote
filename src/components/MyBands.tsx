import Link from "next/link";
import GuitarIcon from "./GuitarIcon";
import type { MyTeam } from "@/actions/team";
import { showDday, showDdayLabel } from "@/lib/team-domain";

/**
 * 홈 "내 밴드" (디자인 리뷰 4A). "내 플레이리스트" 바로 위, 가로 선반(Spotify·YouTube Music 홈):
 * 밴드 카드 = 보라 커버 + 이름 + 공연 D-day(있을 때) · 플레이리스트 N.
 * 밴드가 없으면 섹션을 숨긴다. /join not-found 의 "내 밴드 보기"가 #my-bands 로 온다.
 */
export default function MyBands({ teams }: { teams: MyTeam[] }) {
  if (teams.length === 0) return null;
  const now = new Date();

  return (
    <section id="my-bands" aria-labelledby="my-bands-title" className="mt-10 w-full scroll-mt-6">
      <h2 id="my-bands-title" className="mb-3 text-h3 font-bold text-text">
        내 밴드
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {teams.map((team) => {
          const dday = showDdayLabel(showDday(team.nextShowAt, now));
          return (
            <li key={team.id} className="w-36 shrink-0 snap-start">
              <Link href={`/band/${team.id}`} className="group block">
                {/* The same violet as the band home hero (existing tokens only). */}
                <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-gradient-to-br from-primary to-primary-soft text-white">
                  <span aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-pill bg-primary-hover opacity-70 mix-blend-screen" />
                  <GuitarIcon className="relative h-10 w-10 transition-transform group-hover:scale-105" />
                </span>
                <span className="mt-2 block truncate text-sm font-semibold text-text">{team.name}</span>
                <span className="block truncate text-caption text-text-muted tabular-nums">
                  {dday && (
                    <>
                      {dday}
                      <span className="mx-1 text-text-subtle" aria-hidden>·</span>
                    </>
                  )}
                  플레이리스트 {team.roomCount}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
