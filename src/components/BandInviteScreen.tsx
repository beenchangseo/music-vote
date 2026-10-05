"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import GuitarIcon from "./GuitarIcon";
import LoginButton from "./LoginButton";
import ShowDateTile from "./ShowDateTile";
import { joinTeam } from "@/actions/team";
import { track } from "@/lib/analytics";
import { showDday } from "@/lib/team-domain";
import { teamMessage } from "@/lib/team-messages";

/*
  로그인 복귀 자동 가입의 본인 확인 (eng 3회차 R5).
  "카카오로 로그인하고 들어가기"를 누를 때 이 쿠키를 심고, 돌아와 ?join=1 이면서 쿠키 코드가
  URL 코드와 같을 때만 가입한다. ?join=1 은 누구나 만들 수 있는 주소라 그것만으로는 가입하지 않는다.
  쿠키를 못 쓰는 환경에서는 초대 화면이 그대로 뜨고 "밴드 들어가기"를 한 번 더 누르면 된다.
*/
const JOIN_COOKIE = "plypick_join";

function setJoinCookie(code: string) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${JOIN_COOKIE}=${encodeURIComponent(code)}; Max-Age=600; Path=/join; SameSite=Lax${secure}`;
  } catch {
    // Blocked cookies: the user taps "밴드 들어가기" once more after login.
  }
}

function readJoinCookie(): string | null {
  try {
    for (const part of document.cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === JOIN_COOKIE) return decodeURIComponent(rest.join("="));
    }
  } catch {
    // Unreadable cookie jar: treat as "no mark".
  }
  return null;
}

function clearJoinCookie() {
  try {
    document.cookie = `${JOIN_COOKIE}=; Max-Age=0; Path=/join; SameSite=Lax`;
  } catch {
    // Expires on its own after 10 minutes.
  }
}

interface BandInviteScreenProps {
  code: string;
  name: string;
  loggedIn: boolean;
  memberCount: number;
  /** 앞 3명, owner 먼저 그다음 가입 순 (디자인 2A). */
  previewNames: string[];
  nextShowAt: string | null;
  /** URL 에 ?join=1 이 있었는지. 가입 여부는 마운트 뒤 쿠키로 정한다 (서버 렌더에서는 가입하지 않는다). */
  joinRequested: boolean;
}

/**
 * /join/[inviteCode] 초대 화면 (디자인 리뷰 2A). 비로그인·비멤버 공통.
 * 방 목록과 멤버 전체 이름은 없다. 앞 3명 이름은 아는 사람인지 확인하는 근거다.
 */
export default function BandInviteScreen({
  code,
  name,
  loggedIn,
  memberCount,
  previewNames,
  nextShowAt,
  joinRequested,
}: BandInviteScreenProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoJoinStarted = useRef(false);
  const dday = showDday(nextShowAt, new Date());
  const restCount = memberCount - previewNames.length;

  async function join(auto: boolean) {
    setError(null);
    let result: Awaited<ReturnType<typeof joinTeam>>;
    try {
      result = await joinTeam(code);
    } catch {
      result = { success: false, reason: "write_failed" };
    }
    if (result.success) {
      track("team_joined", { auto });
      router.replace(`/band/${result.teamId}${result.alreadyMember ? "" : "?joined=1"}`);
      return;
    }
    setError(teamMessage(result.reason));
    // A rotated link renders the invalid-invite page on the next server render.
    if (auto) router.replace(`/join/${code}`);
    else if (result.reason === "invite_not_found") router.refresh();
  }

  // Back from Kakao login with ?join=1: join once if this browser started that login.
  useEffect(() => {
    if (!joinRequested || autoJoinStarted.current) return;
    autoJoinStarted.current = true;
    const marked = loggedIn && readJoinCookie() === code;
    if (!marked) {
      router.replace(`/join/${code}`);
      return;
    }
    clearJoinCookie();
    startTransition(() => join(true));
    // join() is recreated every render; this effect must run once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinRequested, loggedIn, code, router]);

  return (
    <main className="min-h-full flex flex-col px-4 pt-6 pb-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="flex items-center gap-1.5 text-caption text-text-muted">
          <span className="text-base font-bold text-text">Plypick</span>
          <span className="text-text-subtle" aria-hidden>·</span>
          <GuitarIcon className="h-4 w-4" />
          밴드 초대
        </p>

        <h1 className="mt-12 truncate text-h1 font-bold text-text motion-safe:animate-slide-up">{name}</h1>

        {(dday.state === "upcoming" || dday.state === "today") && (
          <ShowDateTile dday={dday} className="mt-5 motion-safe:animate-slide-up" />
        )}

        <div className="mt-6">
          <p className="text-body font-semibold text-text tabular-nums">멤버 {memberCount}명</p>
          {previewNames.length > 0 && (
            <p className="mt-0.5 text-sm text-text-muted">
              {previewNames.join(", ")}
              {restCount > 0 && ` 외 ${restCount}명`}
            </p>
          )}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-text-muted">합주방·셋리스트를 이 밴드에서 같이 관리해요</p>

        <div className="mt-10">
          {loggedIn ? (
            <Button
              size="lg"
              fullWidth
              loading={isPending}
              onClick={() => startTransition(() => join(false))}
            >
              밴드 들어가기
            </Button>
          ) : (
            // The cookie must exist before LoginButton starts the OAuth redirect, hence capture.
            <div onClickCapture={() => setJoinCookie(code)}>
              <LoginButton
                next={`/join/${code}?join=1`}
                label="카카오로 로그인하고 들어가기"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-kakao text-base font-semibold text-kakao-text transition hover:bg-kakao-hover active:scale-[0.97] disabled:opacity-60"
              />
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
