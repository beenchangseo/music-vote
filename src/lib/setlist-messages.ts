/**
 * 셋리스트 쓰기 액션이 돌려주는 reason 코드와 화면 문구.
 *
 * 프로덕션 빌드는 throw 된 서버 에러 메시지를 가리기 때문에, 예상된 실패는 reason 으로 돌려주고 화면이 이 맵으로
 * 문구를 만든다. 화면과 서버가 함께 쓰므로 서버 전용 모듈을 import 하지 않는다.
 */
import { ARCHIVED_PLAYLIST_MESSAGE } from "@/domain/playlist-archive";

export type SetlistReason =
  | "playlist_not_found"
  | "archived"
  | "not_logged_in"
  | "not_editor"
  | "invalid_block"
  | "song_not_found"
  | "slot_gone"
  | "invalid_order"
  | "write_failed";

const SETLIST_FALLBACK_MESSAGE = "잠시 후 다시 시도해 주세요";

const SETLIST_REASON_MESSAGES: Record<SetlistReason, string> = {
  playlist_not_found: "플레이리스트를 찾을 수 없어요",
  archived: ARCHIVED_PLAYLIST_MESSAGE,
  not_logged_in: "로그인이 필요해요. 카카오로 로그인해 주세요",
  not_editor: "방장만 셋리스트를 편집할 수 있어요",
  invalid_block: "이름과 시간을 다시 확인해 주세요",
  song_not_found: "그 후보곡을 찾을 수 없어요. 지워졌는지 확인해 주세요",
  slot_gone: "그 사이 셋리스트가 바뀌었어요. 넣을 자리를 다시 골라 주세요",
  invalid_order: "순서를 저장하지 못했어요. 다시 옮겨 주세요",
  write_failed: SETLIST_FALLBACK_MESSAGE,
};

export function setlistMessage(reason: string): string {
  return SETLIST_REASON_MESSAGES[reason as SetlistReason] ?? SETLIST_FALLBACK_MESSAGE;
}

/** 데이터베이스 함수(v26)가 RAISE 한 코드 중 화면에 그대로 돌려줄 것. 나머지는 write_failed 다. */
export function setlistReasonFromDatabase(message: string | undefined): SetlistReason {
  return message === "playlist_not_found" ||
    message === "slot_gone" ||
    message === "song_not_found" ||
    message === "invalid_block" ||
    message === "invalid_order"
    ? message
    : "write_failed";
}
