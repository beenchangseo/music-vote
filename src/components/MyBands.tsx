import Link from "next/link";
import GuitarIcon from "./GuitarIcon";
import type { MyTeam } from "@/actions/team";
import { showDday, showDdayLabel } from "@/lib/team-domain";

/**
 * 홈 "내 밴드" (디자인 리뷰 4A). "내 합주방" 바로 위, 밴드당 한 줄: 이름 · 공연 D-day(있을 때) · 합주방 N.
 * 밴드가 없으면 섹션을 숨긴다. /join not-found 의 "내 밴드 보기"가 #my-bands 로 온다.
 */
export default function MyBands({ teams }: { teams: MyTeam[] }) {
  if (teams.length === 0) return null;
  const now = new Date();

  return (
    <div id="my-bands" className="mt-10 w-full scroll-mt-6">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">내 밴드</h2>
      <div className="space-y-2">
        {teams.map((team) => {
          const dday = showDdayLabel(showDday(team.nextShowAt, now));
          return (
            <Link
              key={team.id}
              href={`/band/${team.id}`}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-all hover:border-border-strong"
            >
              <GuitarIcon className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1 truncate font-medium text-text">{team.name}</span>
              <span className="shrink-0 text-caption text-text-muted tabular-nums">
                {dday && (
                  <>
                    {dday}
                    <span className="mx-1.5 text-text-subtle" aria-hidden>·</span>
                  </>
                )}
                합주방 {team.roomCount}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
