"use client";

import Link from "next/link";
import Card from "./ui/Card";
import Button, { buttonClassName } from "./ui/Button";
import { KakaoInviteButton } from "./BandInviteSheet";

interface BandStartAreaProps {
  /** /new?band={teamId} */
  newRoomHref: string;
  onInvite: () => void;
  /** 넣을 수 있는 내 플레이리스트 수(밴드 홈이 센다). 있으면 넣기가 주 버튼이다. */
  attachableCount: number | null;
  onAttach: () => void;
}

/**
 * 빈 밴드 홈의 시작 영역 (디자인 DR1, eng E2). owner 혼자 · 플레이리스트 0 일 때만 밴드 홈이 그린다.
 * 할 일을 하나로 모은다: 첫 플레이리스트가 주 버튼(넣을 내 플레이리스트가 있으면 "있던 플레이리스트 넣기",
 * 없으면 "첫 플레이리스트 만들기"), 멤버 부르기가 보조. 넣기가 주 버튼일 때 새로 만들기는 작은 링크로 남긴다.
 * 초대로 들어온 멤버가 바로 투표할 곳이 있어야 해서 플레이리스트가 먼저다.
 * 이 영역이 보이는 동안 밴드 홈은 상단 초대 아이콘 · "더 부르기" · 빈 선반을 숨긴다(같은 일을 하는 버튼 중복 금지).
 */
export default function BandStartArea({ newRoomHref, onInvite, attachableCount, onAttach }: BandStartAreaProps) {
  const canAttach = (attachableCount ?? 0) > 0;
  return (
    <Card variant="elevated" role="region" aria-labelledby="band-start-title" className="mt-5 motion-safe:animate-fade-in">
      <h2 id="band-start-title" className="text-body font-semibold text-text">
        첫 플레이리스트부터 시작해요
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">
        곡을 올려 두고 멤버를 부르면, 들어오자마자 같이 투표할 수 있어요
      </p>
      {canAttach ? (
        <Button size="lg" fullWidth className="mt-4" onClick={onAttach}>
          있던 플레이리스트 넣기
        </Button>
      ) : (
        <Link href={newRoomHref} className={buttonClassName({ size: "lg", fullWidth: true, className: "mt-4" })}>
          첫 플레이리스트 만들기
        </Link>
      )}
      <KakaoInviteButton onClick={onInvite} className="mt-2 w-full">
        카톡으로 멤버 부르기
      </KakaoInviteButton>
      {canAttach && (
        <Link
          href={newRoomHref}
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-text-muted transition-colors hover:text-text"
        >
          새 플레이리스트 만들기
        </Link>
      )}
    </Card>
  );
}
