import type { SetlistItem, SongWithScore } from "../types";

const song = (id: string, title: string, duration_seconds: number | null) =>
  ({
    id,
    title,
    artist: `${title} 밴드`,
    duration_seconds,
    tempo_bpm: null,
    key_root: null,
    key_mode: null,
    key_memo: null,
    thumbnail_url: null,
  }) as SongWithScore;

const item = (position: number, fields: Partial<SetlistItem>) =>
  ({
    id: `item-${position}`,
    playlist_id: "playlist",
    position,
    item_type: "song",
    song_id: null,
    label: null,
    description: null,
    duration_seconds: 0,
    title_override: null,
    duration_override_seconds: null,
    created_at: "",
    ...fields,
  }) as SetlistItem;

export const fixtureSongs = [song("a", "첫 곡", 240), song("b", "시간 모르는 곡", null), song("c", "끝 곡", 263)];

/**
 * 인터벌로 시작 · 곡(셋리스트에서 고친 시간) · 인터벌 · 시간 모르는 곡 · 지워진 곡 · 자작곡 · 곡.
 * 후보곡을 지우면 셋리스트 줄은 song_id 만 null 이 되어 남는다(ON DELETE SET NULL). 그 줄은 곡 수·총 시간에 들지 않고 내보내기에도 그리지 않는다.
 */
export const fixtureItems = [
  item(0, { item_type: "interval", label: "사운드 체크", description: "모니터 볼륨 맞추기", duration_seconds: 120 }),
  item(1, { song_id: "a", duration_override_seconds: 200 }),
  item(2, { item_type: "interval", label: "기타 셋업 변경", duration_seconds: 180 }),
  item(3, { song_id: "b" }),
  item(4, { song_id: null }),
  item(5, { item_type: "original", label: "우리 노래", description: "첫 자작곡", duration_seconds: 225 }),
  item(6, { song_id: "c" }),
];

/** 120 + 200 + 180 + 0 + 225 + 263 초. 앱 셋리스트 탭은 "16:28 · 4곡 · 1곡 시간 미입력"이다. */
export const FIXTURE_TOTAL_SECONDS = 988;
export const FIXTURE_SONG_COUNT = 4;
