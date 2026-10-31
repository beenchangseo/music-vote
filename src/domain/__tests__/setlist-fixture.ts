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

/** 곡(셋리스트에서 고친 시간) · 인터벌 · 시간 모르는 곡 · 자작곡 · 곡. */
export const fixtureItems = [
  item(0, { song_id: "a", duration_override_seconds: 200 }),
  item(1, { item_type: "interval", label: "기타 셋업 변경", duration_seconds: 180 }),
  item(2, { song_id: "b" }),
  item(3, { item_type: "original", label: "우리 노래", description: "첫 자작곡", duration_seconds: 225 }),
  item(4, { song_id: "c" }),
];

/** 200 + 180 + 0 + 225 + 263 초. 앱 셋리스트 탭은 "14:28 · 4곡 · 1곡 시간 미입력"이다. */
export const FIXTURE_TOTAL_SECONDS = 868;
export const FIXTURE_SONG_COUNT = 4;
