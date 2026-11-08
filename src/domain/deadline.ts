/**
 * 플레이리스트 마감이 지났는지. 마감이 지나면 투표와 후보곡 받기가 끝난다. 마감 시각 정각은 아직 받는다.
 * cast_playlist_vote(v24 `v_deadline < transaction_timestamp()`)·셋리 자동 확정 크론(`lt deadline`)과 같은 경계다.
 */
export function isPastDeadline(deadline: string | null, now: Date): boolean {
  return deadline !== null && Date.parse(deadline) < now.getTime();
}
