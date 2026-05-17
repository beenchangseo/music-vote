import type { Metadata } from "next";
import Link from "next/link";
import CreatePlaylistForm from "@/components/CreatePlaylistForm";
import MyPlaylists from "@/components/MyPlaylists";
import LoginButton from "@/components/LoginButton";
import { getCurrentUser } from "@/lib/auth";
import { getMyPlaylists } from "@/actions/playlist";

export const metadata: Metadata = {
  title: "플레이리스트 만들기 - Plypick",
  description: "밴드 곡 투표 플레이리스트를 만들어 보세요",
};

export default async function NewPlaylistPage() {
  const user = await getCurrentUser();
  const dbPlaylists = user ? await getMyPlaylists() : [];
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

          {/* Heading */}
          <h1 className="text-h1 font-bold text-text mb-2">
            플레이리스트 만들기
          </h1>
          <p className="text-sm text-text-muted mb-7 leading-relaxed">
            이름만 정하면 끝. 옵션은 나중에 바꿀 수 있어요.
          </p>

          {user ? (
            <>
              <CreatePlaylistForm />
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
              <LoginButton next="/new" />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
