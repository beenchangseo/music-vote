/**
 * 밴드(팀) 순수 로직. DB·시계·브라우저에 닿지 않는다.
 * 현재 시각이 필요한 함수는 `now` 를 인자로 받는다 (안에서 Date.now() 를 읽지 않는다).
 *
 * 날짜는 모두 KST 달력 날짜(YYYY-MM-DD)로 다룬다. 공연 날짜는 시각이 없는 DATE 이고,
 * UTC 로 계산하면 KST 00:00~09:00 사이에 하루가 어긋난다.
 *
 * 화면과 서버가 함께 쓰므로 서버 전용 모듈을 import 하지 않는다.
 */
import type { TeamRole } from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 공연이 끝난 뒤 "공연 끝" 상태를 보여주는 날 수. 그 뒤로는 날짜가 없는 것처럼 본다. */
export const SHOW_ENDED_DAYS = 14;

export const TEAM_NAME_MAX = 50;

/** `now` 시점의 KST 날짜. 날짜 입력의 `min` 과 과거 날짜 판정에 쓴다. */
export function kstDateString(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD 이면서 실제로 있는 날짜면 그 날 UTC 자정의 epoch ms, 아니면 null. */
function parseDateOnly(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return ms;
}

export type ShowDday =
  /** 공연 전. `days` 는 1 이상 (D-12 의 12). */
  | { state: "upcoming"; date: string; days: number }
  /** 공연 당일 (D-DAY). */
  | { state: "today"; date: string }
  /** 공연 1~14일 뒤. "공연 끝 · 수고했어요". */
  | { state: "ended"; date: string; daysAgo: number }
  /** 날짜 없음, 잘못된 값, 또는 공연이 15일 이상 지남. */
  | { state: "none" };

/**
 * 공연 날짜까지 남은 날을 KST 달력 기준으로 센다.
 * 카드(카톡 공유)에는 이 값을 싣지 않는다. 화면에서만 계산해 보여준다 (디자인 25A).
 */
export function showDday(nextShowAt: string | null | undefined, now: Date): ShowDday {
  if (!nextShowAt) return { state: "none" };
  const show = parseDateOnly(nextShowAt);
  if (show === null) return { state: "none" };
  const today = parseDateOnly(kstDateString(now));
  if (today === null) return { state: "none" };

  const diff = Math.round((show - today) / DAY_MS);
  if (diff > 0) return { state: "upcoming", date: nextShowAt, days: diff };
  if (diff === 0) return { state: "today", date: nextShowAt };
  if (-diff <= SHOW_ENDED_DAYS) return { state: "ended", date: nextShowAt, daysAgo: -diff };
  return { state: "none" };
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 공연 날짜의 월·일·요일. 날짜만 보고 정하므로 시간대와 무관하다. 잘못된 값이면 null. */
export function showDateParts(date: string): { month: number; day: number; weekday: string } | null {
  const ms = parseDateOnly(date);
  if (ms === null) return null;
  const d = new Date(ms);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: WEEKDAYS[d.getUTCDay()] };
}

/** "10월 16일(금)", 요일을 빼면 "10월 16일". 잘못된 값이면 null. */
export function formatShowDate(date: string, withWeekday = true): string | null {
  const parts = showDateParts(date);
  if (!parts) return null;
  const base = `${parts.month}월 ${parts.day}일`;
  return withWeekday ? `${base}(${parts.weekday})` : base;
}

/** 화면 전용 D-day 문구. 공연 전·당일만 있고, 지난 공연과 날짜 없음은 null (경로 줄·홈 "내 밴드"). */
export function showDdayLabel(dday: ShowDday): string | null {
  if (dday.state === "upcoming") return `공연 D-${dday.days}`;
  if (dday.state === "today") return "공연 D-DAY";
  return null;
}

/**
 * 카톡 카드에 실어도 되는 공연 날짜. 공연 전·당일만 돌려주고 지난 날짜는 null (디자인 25A).
 * 카드는 며칠 뒤에도 보이므로 D-day 같은 상대 값이 아니라 이 정확한 날짜만 싣는다.
 */
export function shareableShowDate(nextShowAt: string | null | undefined, now: Date): string | null {
  const dday = showDday(nextShowAt, now);
  return dday.state === "upcoming" || dday.state === "today" ? dday.date : null;
}

/** band 카드 설명 (디자인 25A). 날짜가 주인공이고, 날짜가 없거나 지났으면 합류 안내. */
export function bandShareDescription(
  nextShowAt: string | null | undefined,
  memberCount: number,
  now: Date,
): string {
  const date = shareableShowDate(nextShowAt, now);
  return date
    ? `${formatShowDate(date)} 공연 · 멤버 ${memberCount}명`
    : `멤버 ${memberCount}명 · 카카오 로그인 한 번이면 합류`;
}

/** 팀 방 카드 설명 앞의 날짜 접두어 "10월 16일 공연 · ". 실을 날짜가 없으면 빈 문자열. */
export function roomSharePrefix(nextShowAt: string | null | undefined, now: Date): string {
  const date = shareableShowDate(nextShowAt, now);
  return date ? `${formatShowDate(date, false)} 공연 · ` : "";
}

/**
 * 공연 날짜 입력을 검사한다. 지우기(null)는 호출부에서 따로 허용한다.
 * 오늘(KST)은 고를 수 있고, 그 전 날짜는 거부한다.
 */
export function validateNextShowDate(
  value: string,
  now: Date,
): "invalid_date" | "past_date" | null {
  if (typeof value !== "string" || parseDateOnly(value) === null) return "invalid_date";
  // Both sides are zero-padded YYYY-MM-DD, so string order is date order.
  if (value < kstDateString(now)) return "past_date";
  return null;
}

// C0 control characters, DEL and C1 control characters.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * 밴드 이름을 정리하고 검사한다. 제어 문자를 지우고 앞뒤 공백을 자른 뒤 1~50자면 그 값을,
 * 아니면 null 을 돌려준다. 글자 수는 DB CHECK(char_length) 와 같게 코드 포인트로 센다.
 */
export function validateTeamName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(CONTROL_CHARS, "").trim();
  const length = [...name].length;
  if (length < 1 || length > TEAM_NAME_MAX) return null;
  return name;
}

/** 초대 코드 형식 (nanoid 10자). 형식이 아니면 DB 를 조회하지 않는다. */
export function isInviteCodeFormat(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9_-]{10}$/.test(code);
}

/** 밴드 id 형식 (uuid). 형식이 아니면 DB 를 조회하지 않는다 (Postgres 22P02 를 피한다). */
export function isTeamIdFormat(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

/**
 * 이 방에서 "이 멤버로 밴드 만들기"를 할 수 있는지. 안 되면 reason 코드를 돌려준다.
 * 보관 방은 `assertPlaylistWritable` 도 막지만, 이 함수만으로도 판정이 끝나게 둔다.
 */
export function canPromote(
  playlist: { creator_user_id: string | null; team_id: string | null },
  userId: string,
): "archived" | "not_room_owner" | "already_in_team" | null {
  if (!playlist.creator_user_id) return "archived";
  if (playlist.creator_user_id !== userId) return "not_room_owner";
  if (playlist.team_id) return "already_in_team";
  return null;
}

/** 멤버 표시 순서: owner 먼저, 그다음 가입 순 (디자인 2A). 원본 배열은 바꾸지 않는다. */
export function sortMembersForDisplay<T extends { role: TeamRole; joined_at: string | null }>(
  members: T[],
): T[] {
  return [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return (a.joined_at ?? "").localeCompare(b.joined_at ?? "");
  });
}

/**
 * 초대 화면에 보여줄 앞 몇 명의 이름 (owner 먼저, 가입 순).
 * 초대받은 사람이 아는 사람인지 확인하는 근거라 그 이상은 보여주지 않는다.
 */
export function previewMemberNames(
  members: { display_name: string; role: TeamRole; joined_at: string | null }[],
  limit = 3,
): string[] {
  return sortMembersForDisplay(members)
    .slice(0, limit)
    .map((member) => member.display_name);
}

// ============================================================
// 밴드 홈 화면 재료 (방 커버·했던 곡)
// ============================================================

export const ROOM_COVER_MAX = 4;

/** 방 커버 모자이크 썸네일. 셋리스트 곡 먼저(순서대로), 모자라면 최근에 올라온 곡. 같은 그림은 한 번만. */
export function roomCoverThumbs(
  setlist: { thumbnailUrl: string | null }[],
  recentSongs: { thumbnailUrl: string | null }[],
): string[] {
  const thumbs: string[] = [];
  for (const { thumbnailUrl } of [...setlist, ...recentSongs]) {
    if (!thumbnailUrl || thumbs.includes(thumbnailUrl)) continue;
    thumbs.push(thumbnailUrl);
    if (thumbs.length === ROOM_COVER_MAX) break;
  }
  return thumbs;
}

export interface PlayedSong {
  key: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  /** 이 곡이 셋리스트에 오른 합주방 수. */
  times: number;
  /** 가장 최근에 이 곡을 한 방. 행을 누르면 그 방으로 간다. */
  latestShareCode: string;
}

type PlayedRoom = {
  shareCode: string;
  setlist: { title: string; artist: string | null; videoId: string | null; thumbnailUrl: string | null }[];
};

/**
 * E1 "우리가 했던 곡": 모든 방의 셋리스트를 곡 단위로 묶는다. 방마다 song 행이 따로라 songId 로는
 * 못 묶고, 같은 유튜브 영상(없으면 제목+아티스트)을 한 곡으로 센다. 많이 한 곡 먼저, 같으면 최근 방 먼저.
 * `rooms` 는 최근 방이 앞에 오는 순서(getTeamHome 의 created_at 내림차순)여야 한다.
 */
export function aggregatePlayedSongs(rooms: PlayedRoom[]): PlayedSong[] {
  const byKey = new Map<string, { song: PlayedSong; firstRoom: number }>();
  rooms.forEach((room, roomIndex) => {
    const seenInRoom = new Set<string>();
    for (const item of room.setlist) {
      const key = item.videoId
        ? `v:${item.videoId}`
        : `t:${item.title.trim().toLowerCase()}|${(item.artist ?? "").trim().toLowerCase()}`;
      if (seenInRoom.has(key)) continue;
      seenInRoom.add(key);
      const hit = byKey.get(key);
      if (hit) {
        hit.song.times += 1;
        continue;
      }
      byKey.set(key, {
        firstRoom: roomIndex,
        song: {
          key,
          title: item.title,
          artist: item.artist,
          thumbnailUrl: item.thumbnailUrl,
          times: 1,
          latestShareCode: room.shareCode,
        },
      });
    }
  });
  return [...byKey.values()]
    .sort((a, b) => b.song.times - a.song.times || a.firstRoom - b.firstRoom)
    .map((entry) => entry.song);
}
