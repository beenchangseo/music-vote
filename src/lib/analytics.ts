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
    variant: "playlist" | "decided" | "setlist" | "band";
  };
  // 밴드(팀). 사람·날짜 단위 성공 지표는 DB 로 센다(scripts/team-metrics.mjs). 이벤트는 경로 비교용.
  team_created: {
    // card = 방의 안내 카드, settings = 방 설정, attach = 기존 방을 내 밴드에 넣음(팀 행은 새로 안 생김)
    source: "card" | "settings" | "attach";
  };
  team_joined: {
    // true = 로그인 복귀 자동 가입(?join=1), false = "밴드 들어가기" 버튼
    auto: boolean;
  };
  team_playlist_created: {
    has_next_show: boolean;
  };
  band_home_viewed: {
    role: "owner" | "member";
  };
  team_next_show_set: {
    cleared: boolean;
  };
  // E4: 같은 밴드의 지난 곡에서 키·BPM 을 가져와 곡을 넣었다
  song_meta_prefilled: Record<string, never>;
  setlist_confirmed: {
    song_count: number;
    auto: boolean;
  };
  setlist_exported: {
    format: "image" | "pdf";
  };
  setlist_shared: { method: "link" };
  meta_edited: {
    field: "key" | "key_memo" | "bpm" | "duration" | "difficulty" | "genre";
  };
  tap_tempo_used: {
    taps: number;
  };
  /** 플레이리스트 하단 탭 전환. 합주 탭을 실제로 여는지 본다. */
  playlist_tab_viewed: {
    tab: "candidates" | "setlist" | "rehearsal";
  };
  /** 합주 탭에서 누른 것. 합주 탭의 1순위 기능을 데이터로 정하려고 잰다 (2026-10-05). 탭 템포는 tap_tempo_used. */
  rehearsal_action: {
    action: "next" | "prev" | "metronome_on" | "metronome_off" | "meta_open";
  };
  /** 플레이리스트 헤더 "전체 듣기" (후보곡 1위부터). */
  play_all_started: {
    song_count: number;
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
