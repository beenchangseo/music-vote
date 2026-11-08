/**
 * 플레이리스트가 지금 어느 단계인지와 그 낱말. 밴드 홈 카드·선반과 후보곡 탭의 확정 배지가 모두 이 표를 읽어서,
 * 같은 단계를 화면마다 다르게 부르지 않는다(#80). 셋리스트는 플레이리스트 안의 곡 순서라 단계 이름에만 들어간다.
 */
export type PlaylistStage = "voting" | "building" | "confirmed";

export const PLAYLIST_STAGE_LABEL: Record<PlaylistStage, string> = {
  voting: "투표 중",
  building: "셋리스트 짜는 중",
  confirmed: "셋리스트 확정",
};

export function playlistStage({ setlistConfirmed, setlistCount }: { setlistConfirmed: boolean; setlistCount: number }): PlaylistStage {
  if (setlistConfirmed) return "confirmed";
  return setlistCount > 0 ? "building" : "voting";
}
