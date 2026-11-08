import type { SetlistItem } from "./types";

/**
 * 플레이리스트가 지금 어느 단계인지와 그 낱말. 밴드 홈 카드·선반과 후보곡 탭의 확정 배지가 모두 이 표를 읽어서,
 * 같은 단계를 화면마다 다르게 부르지 않는다(#80). 셋리스트는 플레이리스트 안의 곡 순서라 단계 이름에만 들어간다.
 */
export type PlaylistStage = "voting" | "building" | "confirmed" | "closed";

export const PLAYLIST_STAGE_LABEL: Record<PlaylistStage, string> = {
  voting: "투표 중",
  building: "셋리스트 짜는 중",
  confirmed: "셋리스트 확정",
  closed: "마감",
};

/**
 * 셋리스트에 든 곡 블록인지. 곡과 자작곡은 세고, 인터벌과 곡이 지워진 블록(song_id SET NULL)은 세지 않는다.
 * 셋리스트 화면이 그리는 줄과 같다.
 */
export function isSetlistBlock(item: Pick<SetlistItem, "item_type" | "song_id">): boolean {
  return item.item_type === "original" || (item.item_type === "song" && item.song_id !== null);
}

/**
 * 확정 표시는 셋리스트가 있다는 뜻이 아니다. 크론이 곡 없이 마감된 플레이리스트도 큐에서 빼려고 켜서,
 * 블록 없이 확정된 플레이리스트는 마감이다.
 */
export function playlistStage({
  setlistConfirmed,
  setlistBlockCount,
}: {
  setlistConfirmed: boolean;
  /** `isSetlistBlock` 으로 센 블록 수. */
  setlistBlockCount: number;
}): PlaylistStage {
  if (setlistConfirmed) return setlistBlockCount > 0 ? "confirmed" : "closed";
  return setlistBlockCount > 0 ? "building" : "voting";
}
