import AuthMenu from "../auth/AuthMenu";
import LoginButton from "../auth/LoginButton";
import { showDday, showDdayLabel } from "@/domain/team";

interface PlaylistTopBarProps {
  /** Band members only (5A): anyone else holding the playlist link does not get the band. */
  band: { name: string; nextShowAt: string | null } | null;
  currentUserNickname?: string;
  currentUserAvatarUrl?: string | null;
  loginGate: boolean;
}

/**
 * 플레이리스트 세 탭의 맨 윗줄. 탭을 바꿔도 같은 자리에 같은 모양으로 남는다.
 * 밴드 멤버에게는 "밴드 · 공연 D-n" 을 글자로만 보인다. 밴드 홈과 앱 홈으로 가는 길은 아래 탭의 맨 앞 칸 하나다(#106).
 */
export default function PlaylistTopBar({ band, currentUserNickname, currentUserAvatarUrl, loginGate }: PlaylistTopBarProps) {
  const dday = band ? showDdayLabel(showDday(band.nextShowAt, new Date())) : null;

  return (
    <header className="flex min-h-11 items-center gap-3">
      {band && (
        <p className="flex min-w-0 items-center gap-1 text-body text-text-muted">
          <span className="truncate">{band.name}</span>
          {dday && (
            <>
              <span className="text-text-subtle" aria-hidden>
                ·
              </span>
              <span className="shrink-0 tabular-nums">{dday}</span>
            </>
          )}
        </p>
      )}
      <div className="ml-auto flex shrink-0">
        {currentUserNickname ? (
          <AuthMenu nickname={currentUserNickname} avatarUrl={currentUserAvatarUrl ?? null} embedded />
        ) : (
          loginGate && <LoginButton variant="tonal" size="sm" label="로그인" />
        )}
      </div>
    </header>
  );
}
