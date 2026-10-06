import type { Metadata } from "next";
import Link from "next/link";
import CreatePlaylistForm from "@/components/CreatePlaylistForm";
import MyPlaylists from "@/components/MyPlaylists";
import LoginButton from "@/components/LoginButton";
import GuitarIcon from "@/components/GuitarIcon";
import { buttonClassName } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { getMyPlaylists } from "@/actions/playlist";
import { getMyTeams, getTeamHome } from "@/actions/team";

export const metadata: Metadata = {
  title: "플레이리스트 만들기 - Plypick",
  description: "밴드 곡 투표 플레이리스트를 만들어 보세요",
};

interface PageProps {
  searchParams: Promise<{ band?: string | string[] }>;
}

export default async function NewPlaylistPage({ searchParams }: PageProps) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  const bandId = typeof query.band === "string" && query.band ? query.band : null;
  // My bands ride on the same round trip as my rooms (eng 3회차 13A correction).
  // A failed lookup shows as empty here (eng E1): the form still works, only the lists are missing.
  const [{ playlists: dbPlaylists }, { teams: myTeams }] = user
    ? await Promise.all([getMyPlaylists(), getMyTeams()])
    : [{ playlists: [] }, { teams: [] }];

  // /new?band={teamId} (R10). A band I belong to is in myTeams; otherwise tell "missing" from
  // "not a member" without offering any way in (a teamId cannot invite).
  let band: { id: string; name: string; nextShowAt: string | null } | null = bandId
    ? (myTeams.find((team) => team.id === bandId) ?? null)
    : null;
  let bandProblem: string | null = null;
  if (user && bandId && !band) {
    // Rare path (unknown id, non-member, or getMyTeams fell back to []): ask the band itself.
    const home = await getTeamHome(bandId);
    if (home?.access === "member") band = { id: home.team.id, name: home.team.name, nextShowAt: home.team.nextShowAt };
    else bandProblem = home ? "밴드 멤버만 만들 수 있어요" : "밴드를 찾을 수 없어요";
  }

  return (
    <main className="min-h-full flex flex-col">
      <section className="flex-1 flex flex-col px-4 pt-6 pb-10">
        <div className="w-full max-w-md mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              홈으로
            </Link>
            <span className="text-caption text-text-subtle">새 플레이리스트</span>
          </div>

          {bandProblem ? (
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <p className="text-body text-text mb-5 font-semibold">{bandProblem}</p>
              <Link href="/" className={buttonClassName({ size: "md" })}>
                홈으로
              </Link>
            </div>
          ) : (
            <>
              {/* Heading */}
              <h1 className="text-h1 font-bold text-text mb-2">
                플레이리스트 만들기
              </h1>
              <p className="text-sm text-text-muted mb-7 leading-relaxed">
                이름만 정하면 끝. 옵션은 나중에 바꿀 수 있어요.
              </p>

              {user ? (
                <>
                  {band && (
                    // 17A: a static label, not a Chip (no focus, no tap).
                    <span className="mb-3 inline-flex max-w-full items-center gap-1.5 rounded-pill bg-surface-hover px-3 py-1 text-caption text-text-muted">
                      <GuitarIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{band.name}의 플레이리스트</span>
                    </span>
                  )}
                  <CreatePlaylistForm band={band} myTeams={myTeams} />
                  <MyPlaylists dbPlaylists={dbPlaylists} />
                </>
              ) : (
                <div className="bg-surface border border-border rounded-2xl p-6 text-center">
                  <p className="text-body text-text mb-2 font-semibold">
                    플레이리스트를 만들려면 로그인이 필요해요
                  </p>
                  <p className="text-sm text-text-muted mb-5 leading-relaxed">
                    카카오 계정으로 1초만에 시작할 수 있어요.<br />
                    내가 만든 플레이리스트는 어디서든 다시 열 수 있어요.
                  </p>
                  {/* Keep ?band= through login, or the room is made outside the band without notice. */}
                  <LoginButton next={bandId ? `/new?band=${encodeURIComponent(bandId)}` : "/new"} />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
