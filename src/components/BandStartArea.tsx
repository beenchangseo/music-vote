"use client";

import Link from "next/link";
import Card from "./ui/Card";
import { buttonClassName } from "./ui/Button";
import { KakaoInviteButton } from "./BandInviteSheet";

interface BandStartAreaProps {
  /** /new?band={teamId} */
  newRoomHref: string;
  onInvite: () => void;
}

/**
 * 빈 밴드 홈의 시작 영역 (디자인 DR1, eng E2). owner 혼자 · 플레이리스트 0 일 때만 밴드 홈이 그린다.
 * 할 일을 하나로 모은다: 첫 플레이리스트가 주 버튼, 멤버 부르기가 보조.
 * 초대로 들어온 멤버가 바로 투표할 곳이 있어야 해서 플레이리스트가 먼저다.
 * 이 영역이 보이는 동안 밴드 홈은 상단 초대 아이콘 · "더 부르기" · 빈 선반을 숨긴다(같은 일을 하는 버튼 중복 금지).
 */
export default function BandStartArea({ newRoomHref, onInvite }: BandStartAreaProps) {
  return (
    <Card variant="elevated" role="region" aria-labelledby="band-start-title" className="mt-5 motion-safe:animate-fade-in">
      <h2 id="band-start-title" className="text-body font-semibold text-text">
        첫 플레이리스트를 만들어요
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">
        곡을 올려 두고 멤버를 부르면, 들어오자마자 같이 투표할 수 있어요
      </p>
      <Link href={newRoomHref} className={buttonClassName({ size: "lg", fullWidth: true, className: "mt-4" })}>
        첫 플레이리스트 만들기
      </Link>
      <KakaoInviteButton onClick={onInvite} className="mt-2 w-full">
        카톡으로 멤버 부르기
      </KakaoInviteButton>
    </Card>
  );
}
