import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BandHomeClient from "@/components/BandHomeClient";
import LoginButton from "@/components/LoginButton";
import { buttonClassName } from "@/components/ui/Button";
import { getTeamHome } from "@/actions/team";

// generateMetadata and the page read the same band once per request.
const loadTeamHome = cache((teamId: string) => getTeamHome(teamId));

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ created?: string | string[]; joined?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamId } = await params;
  const view = await loadTeamHome(teamId);
  return {
    title: view ? `${view.team.name} · Plypick` : "Plypick",
    // A band home is a members' page, not a search result.
    robots: { index: false },
  };
}

export default async function BandPage({ params, searchParams }: PageProps) {
  const [{ teamId }, query] = await Promise.all([params, searchParams]);
  const view = await loadTeamHome(teamId);
  if (!view) notFound();

  if (view.access === "guest") {
    return <MembersOnly teamId={view.team.id} name={view.team.name} loggedIn={view.loggedIn} />;
  }

  return <BandHomeClient view={view} created={query.created === "1"} joined={query.joined === "1"} />;
}

/**
 * 비멤버·비로그인이 /band/{teamId} 를 열었을 때 (디자인 2회차 2A·3A). 이름 + 이유 한 줄 + 행동 하나.
 * 방 목록·멤버 이름·공연 날짜·초대 링크는 없다. teamId 로는 가입할 수 없다 (R10).
 */
function MembersOnly({ teamId, name, loggedIn }: { teamId: string; name: string; loggedIn: boolean }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-bg text-text">
      <div className="w-full max-w-sm text-center">
        <h1 className="truncate text-h2 font-bold">{name}</h1>
        <p className="mt-2 text-body text-text">밴드 멤버만 볼 수 있어요</p>
        <p className="mt-1 mb-7 text-sm leading-relaxed text-text-muted">
          {loggedIn ? "들어가려면 밴드 멤버에게 초대 링크를 받아 주세요" : "멤버라면 로그인하면 바로 들어가요"}
        </p>
        {loggedIn ? (
          <Link href="/" className={buttonClassName({ variant: "secondary", size: "md" })}>
            홈으로
          </Link>
        ) : (
          <LoginButton next={`/band/${teamId}`} label="카카오로 로그인" />
        )}
      </div>
    </main>
  );
}
