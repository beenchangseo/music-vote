import { getCurrentUser } from "@/lib/auth";

export default async function AuthButton() {
  const user = await getCurrentUser();

  // 비로그인 사용자에겐 우상단 버튼 숨김.
  // 진입로는 HeroCTA, /new 게이트, Invitation banner 가 담당.
  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-surface border border-border">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
            {user.nickname.slice(0, 1)}
          </div>
        )}
        <span className="hidden sm:inline text-sm text-text max-w-[7rem] truncate">
          {user.nickname}
        </span>
      </div>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="h-10 px-2 text-caption text-text-muted hover:text-text transition-colors"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
