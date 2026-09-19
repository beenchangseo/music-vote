/**
 * 보관된 합주방: 카카오 로그인을 도입하기 전에 만들어진 익명 합주방.
 * `creator_user_id` 가 비어 있어 표와 글을 계정으로 묶을 수 없다.
 * 지난 기록은 그대로 볼 수 있지만 새로 쓸 수는 없다.
 *
 * 화면과 서버가 함께 쓰므로 서버 전용 모듈을 import 하지 않는다.
 */
export const ARCHIVED_PLAYLIST_MESSAGE =
  "보관된 합주방이에요. 지난 기록은 그대로 볼 수 있지만 새로 쓸 수는 없어요.";

export function isArchivedPlaylist(playlist: { creator_user_id: string | null }): boolean {
  return !playlist.creator_user_id;
}
