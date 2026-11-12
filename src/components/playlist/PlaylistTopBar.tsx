import Link from "next/link";
import { RoundLink } from "../ui/RoundButton";
import { BackIcon } from "../ui/icons";
import AuthMenu from "../auth/AuthMenu";
import LoginButton from "../auth/LoginButton";
import { showDday, showDdayLabel } from "@/domain/team";

interface PlaylistTopBarProps {
  /** Band members only (5A): the link would otherwise hand the band to anyone holding the playlist link. */
  band: { id: string; name: string; nextShowAt: string | null } | null;
  currentUserNickname?: string;
  currentUserAvatarUrl?: string | null;
  loginGate: boolean;
}

/**
 * 플레이리스트 세 탭의 맨 윗줄. 탭을 바꿔도 같은 자리에 같은 모양으로 남는다.
 * 밴드 멤버는 "‹ 밴드 · 공연 D-n" 으로 밴드에, 나머지는 맨 chevron 으로 홈에 간다.
 * 두 chevron 은 같은 24px 글리프이고 내용 왼쪽 끝에 붙는다. 링크는 RoundLink edge="start" 가, 밴드 줄은 글리프가 맨 앞이라 그렇다.
 */
export default function PlaylistTopBar({ band, currentUserNickname, currentUserAvatarUrl, loginGate }: PlaylistTopBarProps) {
  const dday = band ? showDdayLabel(showDday(band.nextShowAt, new Date())) : null;

  return (
    <header className="flex min-h-11 items-center justify-between gap-3">
      {band ? (
        <Link
          href={`/band/${band.id}`}
          className="inline-flex min-h-11 min-w-0 items-center gap-1 text-body text-text-muted transition-colors hover:text-text"
        >
          <BackIcon className="size-6 shrink-0 text-text" />
          <span className="truncate">{band.name}</span>
          {dday && (
            <>
              <span className="text-text-subtle" aria-hidden>
                ·
              </span>
              <span className="shrink-0 tabular-nums">{dday}</span>
            </>
          )}
        </Link>
      ) : (
        <RoundLink href="/" tone="plain" size="md" edge="start" aria-label="홈으로">
          <BackIcon />
        </RoundLink>
      )}
      {currentUserNickname ? (
        <AuthMenu nickname={currentUserNickname} avatarUrl={currentUserAvatarUrl ?? null} embedded />
      ) : (
        loginGate && <LoginButton variant="tonal" size="sm" label="로그인" className="shrink-0" />
      )}
    </header>
  );
}
