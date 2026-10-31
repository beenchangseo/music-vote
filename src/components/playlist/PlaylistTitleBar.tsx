import Link from "next/link";
import AuthMenu from "../auth/AuthMenu";

interface PlaylistTitleBarProps {
  title: string;
  band?: { id: string; name: string } | null;
  currentUserNickname?: string;
  currentUserAvatarUrl?: string | null;
}

export default function PlaylistTitleBar({ title, band, currentUserNickname, currentUserAvatarUrl }: PlaylistTitleBarProps) {
  return (
    <header className="-mt-3 flex min-h-12 items-center gap-1.5 text-body">
      <Link
        href={band ? `/band/${band.id}` : "/"}
        aria-label={band ? undefined : "홈으로"}
        className="-ml-2.5 inline-flex min-h-11 min-w-11 max-w-[45%] shrink-0 items-center gap-1 text-text-muted transition-colors hover:text-text"
      >
        <svg className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {band && <span className="truncate">{band.name}</span>}
      </Link>
      {band && (
        <span className="text-text-subtle" aria-hidden>
          ·
        </span>
      )}
      <h1 className="min-w-0 flex-1 truncate font-semibold text-text">{title}</h1>
      {currentUserNickname && <AuthMenu nickname={currentUserNickname} avatarUrl={currentUserAvatarUrl ?? null} embedded />}
    </header>
  );
}
