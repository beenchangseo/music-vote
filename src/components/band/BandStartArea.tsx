"use client";

import Card from "../ui/Card";
import Button from "../ui/Button";

/**
 * 빈 밴드 홈의 시작 영역 (디자인 DR1, eng E2). owner 혼자 · 플레이리스트 0 일 때만 밴드 홈이 그린다.
 * 첫 플레이리스트는 아래 탭의 ＋ 만들기가 만든다(#110). 같은 일을 하는 버튼을 두 개 두지 않으려고 여기에는 그쪽을 가리키는
 * 글만 두고, 버튼은 멤버 부르기 하나다.
 * 이 영역이 보이는 동안 밴드 홈은 상단 초대 아이콘 · "더 부르기" · 빈 선반을 숨긴다(같은 일을 하는 버튼 중복 금지).
 */
export default function BandStartArea({ onInvite }: { onInvite: () => void }) {
  return (
    <Card variant="elevated" role="region" aria-labelledby="band-start-title" className="mt-5 motion-safe:animate-fade-in">
      <h2 id="band-start-title" className="text-body font-semibold text-text">
        첫 플레이리스트부터 시작해요
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">
        아래 ＋ 만들기로 첫 플레이리스트를 만들어요. 곡을 올려 두고 멤버를 부르면, 들어오자마자 같이 투표할 수 있어요
      </p>
      <Button variant="kakao" onClick={onInvite} fullWidth className="mt-4">
        카톡으로 멤버 부르기
      </Button>
    </Card>
  );
}
