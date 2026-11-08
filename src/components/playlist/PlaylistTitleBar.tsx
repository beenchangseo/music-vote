import Link from "next/link";
import { RoundLink } from "../ui/RoundButton";
import AuthMenu from "../auth/AuthMenu";
import LoginButton from "../auth/LoginButton";

interface PlaylistTitleBarProps {
  title: string;
  band?: { id: string; name: string } | null;
  currentUserNickname?: string;
  currentUserAvatarUrl?: string | null;
  loginGate?: boolean;
}

export default function PlaylistTitleBar({ title, band, currentUserNickname, currentUserAvatarUrl, loginGate = false }: PlaylistTitleBarProps) {
  return (
    <header className="flex min-h-12 items-center gap-1.5 text-body">
      {band ? (
        <>
          {/* Same chevron, at the same x, as the band link in PlaylistHeader on the 후보곡 tab. */}
          <Link
            href={`/band/${band.id}`}
            className="inline-flex min-h-11 max-w-1/2 shrink-0 items-center gap-1 text-text-muted transition-colors hover:text-text"
          >
            <svg className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="truncate">{band.name}</span>
          </Link>
          <span className="text-text-subtle" aria-hidden>
            ·
          </span>
        </>
      ) : (
        <RoundLink href="/" tone="ghost" size="md" edge="start" aria-label="홈으로">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </RoundLink>
      )}
      <h1 className="min-w-0 flex-1 truncate font-semibold text-text">{title}</h1>
      {currentUserNickname && <AuthMenu nickname={currentUserNickname} avatarUrl={currentUserAvatarUrl ?? null} embedded />}
      {loginGate && <LoginButton variant="tonal" size="sm" label="로그인" className="shrink-0" />}
    </header>
  );
}
