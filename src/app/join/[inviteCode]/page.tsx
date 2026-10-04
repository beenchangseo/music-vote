import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import BandInviteScreen from "@/components/BandInviteScreen";
import { getTeamInvite } from "@/actions/team";
import { bandShareDescription, shareableShowDate } from "@/lib/team-domain";

// generateMetadata and the page read the same invite once per request.
const loadInvite = cache((inviteCode: string) => getTeamInvite(inviteCode));

interface PageProps {
  params: Promise<{ inviteCode: string }>;
  searchParams: Promise<{ join?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { inviteCode } = await params;
  const invite = await loadInvite(inviteCode);
  // Invite links live in group chats; keep them out of search results.
  if (!invite) return { title: "Plypick", robots: { index: false } };
  if (invite.status === "member") return { title: `${invite.name} · Plypick`, robots: { index: false } };

  // Same text as the band Kakao card so a pasted link unfurls the same way (25A: exact date only).
  const now = new Date();
  const title = `${invite.name} · Plypick`;
  const description = bandShareDescription(invite.nextShowAt, invite.memberCount, now);
  const og = new URLSearchParams({ variant: "band", title: invite.name, members: String(invite.memberCount) });
  const date = shareableShowDate(invite.nextShowAt, now);
  if (date) og.set("date", date);

  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website", images: [`/api/og?${og.toString()}`] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function JoinPage({ params, searchParams }: PageProps) {
  const [{ inviteCode }, query] = await Promise.all([params, searchParams]);
  const invite = await loadInvite(inviteCode);
  if (!invite) notFound();
  // Already a member: the band home is the member address (R10).
  if (invite.status === "member") redirect(`/band/${invite.teamId}`);

  return (
    <BandInviteScreen
      code={inviteCode}
      name={invite.name}
      loggedIn={invite.loggedIn}
      memberCount={invite.memberCount}
      previewNames={invite.previewNames}
      nextShowAt={invite.nextShowAt}
      joinRequested={query.join === "1"}
    />
  );
}
