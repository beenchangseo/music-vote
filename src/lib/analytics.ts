// Vercel Analytics 커스텀 이벤트 wrapper.
// 타입 명시 + property 키 통일 + 실패 시 silent.

import { track as vercelTrack } from "@vercel/analytics";

// 이벤트 이름은 snake_case 일관. 데이터 분석 시 grep 쉬움.
type EventMap = {
  playlist_created: {
    has_deadline: boolean;
    setlist_count: number;
  };
  song_added: {
    has_thumbnail: boolean;
  };
  vote_cast: {
    vote_type: 1 | -1;
  };
  vote_toggled: {
    vote_type: 1 | -1;
  };
  vote_changed: {
    from: 1 | -1;
    to: 1 | -1;
  };
  kakao_shared: {
    variant: "playlist" | "decided" | "setlist";
  };
  setlist_confirmed: {
    song_count: number;
    auto: boolean;
  };
  setlist_exported: {
    format: "ics" | "image" | "print";
  };
  meta_edited: {
    field: "key" | "key_memo" | "bpm" | "duration" | "difficulty" | "genre";
  };
  filter_applied: {
    type: "bpm" | "meta_only" | "key" | "difficulty" | "genre";
  };
  auth_login_start: {
    provider: "kakao";
  };
  auth_login_success: {
    provider: "kakao";
  };
  auth_logout: Record<string, never>;
};

type EventName = keyof EventMap;

export function track<E extends EventName>(
  event: E,
  properties: EventMap[E],
): void {
  try {
    // Vercel Analytics는 Record<string, AllowedValue> 받음
    vercelTrack(
      event,
      properties as unknown as Record<
        string,
        string | number | boolean | null
      >,
    );
  } catch {
    // 분석 실패가 UX 깨면 안 됨
  }
}
