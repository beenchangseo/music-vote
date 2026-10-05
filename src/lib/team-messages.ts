/**
 * 밴드(팀) 서버 액션이 돌려주는 reason 코드와 화면 문구.
 *
 * 팀 액션은 예상된 실패를 throw 하지 않고 `{ success: false, reason }` 으로 돌려준다.
 * 프로덕션 빌드는 throw 된 서버 에러 메시지를 가리기 때문에, 화면은 이 맵으로 문구를 만든다.
 * 맵에 없는 값이나 throw 된 에러는 기본 문구로 떨어진다.
 *
 * 화면과 서버가 함께 쓰므로 서버 전용 모듈을 import 하지 않는다.
 */
import { ARCHIVED_PLAYLIST_MESSAGE } from "@/lib/playlist-archive";

export type TeamReason =
  | "not_logged_in"
  | "invalid_name"
  | "invalid_title"
  | "invalid_voting_mode"
  | "invalid_vote_limit"
  | "invalid_date"
  | "past_date"
  | "playlist_not_found"
  | "archived"
  | "not_room_owner"
  | "already_in_team"
  | "team_not_found"
  | "invite_not_found"
  | "not_member"
  | "not_team_owner"
  | "cannot_remove_self"
  | "member_not_found"
  | "owner_cannot_leave"
  | "invite_code_conflict"
  | "invite_rotated_remove_failed"
  | "write_failed";

export const TEAM_FALLBACK_MESSAGE = "잠시 후 다시 시도해 주세요";

const TEAM_REASON_MESSAGES: Record<TeamReason, string> = {
  not_logged_in: "로그인이 필요해요. 카카오로 로그인해 주세요",
  invalid_name: "밴드 이름은 1~50자로 써 주세요",
  invalid_title: "합주방 제목은 1~100자로 써 주세요",
  invalid_voting_mode: "투표 방식을 다시 골라 주세요",
  invalid_vote_limit: "기본 투표권은 1~99개로 정해 주세요",
  invalid_date: "공연 날짜를 다시 골라 주세요",
  past_date: "지난 날짜는 고를 수 없어요. 오늘이나 그 뒤 날짜를 골라 주세요",
  playlist_not_found: "합주방을 찾을 수 없어요",
  archived: ARCHIVED_PLAYLIST_MESSAGE,
  not_room_owner: "방장만 할 수 있어요",
  already_in_team: "이미 다른 밴드에 들어 있는 방이에요",
  team_not_found: "밴드를 찾을 수 없어요",
  invite_not_found: "이 초대 링크는 더 이상 쓸 수 없어요. 밴드 멤버에게 새 링크를 받아 주세요",
  not_member: "밴드 멤버만 할 수 있어요",
  not_team_owner: "밴드를 만든 사람만 할 수 있어요",
  cannot_remove_self: "자기 자신은 내보낼 수 없어요",
  member_not_found: "이미 밴드에 없는 멤버예요",
  owner_cannot_leave: "밴드를 만든 사람은 나갈 수 없어요",
  invite_code_conflict: TEAM_FALLBACK_MESSAGE,
  invite_rotated_remove_failed: "링크는 바꿨지만 내보내지 못했어요. 다시 눌러 주세요",
  write_failed: TEAM_FALLBACK_MESSAGE,
};

/**
 * reason 코드(또는 catch 로 잡은 무엇이든)를 화면 문구로 바꾼다.
 * 모르는 코드, throw 된 Error, undefined 는 모두 기본 문구가 된다.
 */
export function teamMessage(reasonOrError: unknown): string {
  if (typeof reasonOrError === "string" && Object.hasOwn(TEAM_REASON_MESSAGES, reasonOrError)) {
    return TEAM_REASON_MESSAGES[reasonOrError as TeamReason];
  }
  return TEAM_FALLBACK_MESSAGE;
}
