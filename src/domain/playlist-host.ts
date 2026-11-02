import { isArchivedPlaylist } from "./playlist-archive";

export type HostDenial = "archived" | "not_logged_in" | "not_host";

/**
 * 방장은 플레이리스트를 만든 로그인 계정이다. 되면 null, 안 되면 그 이유.
 * 화면은 방장 버튼을 그릴지, 서버는 방장 쓰기를 받을지 이 하나로 정한다. 기기에 남은 링크 토큰은 보지 않는다.
 */
export function hostDenial(playlist: { creator_user_id: string | null }, userId: string | null | undefined): HostDenial | null {
  if (isArchivedPlaylist(playlist)) return "archived";
  if (!userId) return "not_logged_in";
  return userId === playlist.creator_user_id ? null : "not_host";
}
