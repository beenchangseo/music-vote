import { displayTitle } from "./song-meta";

/**
 * 투표 초대 카드(카톡 공유 이미지와 플레이리스트 링크 미리보기)에 싣는 곡.
 * 초대장이 순위를 미리 보여 주지 않도록 점수가 아니라 올라온 순서를 쓴다 (#11).
 */

/** 커버. 곡이 없으면 없음, 다른 그림이 1~3개면 첫 곡 한 장, 4개 이상이면 2×2. 값은 YouTube 영상 id. */
export type InviteCover = readonly [] | readonly [string] | readonly [string, string, string, string];

export interface InviteSongs {
  cover: InviteCover;
  /** 먼저 올라온 곡의 표시 제목, 최대 2개, 미리 자른 것. */
  names: string[];
  /** 플레이리스트의 전체 곡 수. */
  count: number;
}

type InviteSong = { title: string; youtube_video_id: string; created_at: string };

const NAME_COUNT = 2;
const NAME_MAX = 12;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function toCover(ids: string[]): InviteCover {
  const unique = [...new Set(ids.filter((id) => VIDEO_ID.test(id)))];
  if (unique.length >= 4) return [unique[0], unique[1], unique[2], unique[3]];
  if (unique.length > 0) return [unique[0]];
  return [];
}

// Firefox gained Intl.Segmenter in 125 while Next 16 supports 111+; there code points are the closest count.
const graphemes = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** 보이는 글자(grapheme)로 세어 NAME_MAX 를 넘으면 단어 경계에서 자르고 "…" 를 붙인다. 이모지 가족·국기를 가르지 않는다. */
function clipName(name: string): string {
  const trimmed = name.trim();
  const chars = graphemes ? Array.from(graphemes.segment(trimmed), (s) => s.segment) : Array.from(trimmed);
  if (chars.length <= NAME_MAX) return chars.join("");
  let cut = chars.slice(0, NAME_MAX - 1).join("");
  const space = cut.lastIndexOf(" ");
  if (space >= 4) cut = cut.slice(0, space);
  return cut.replace(/[\s([（·\-–]+$/u, "") + "…";
}

export function inviteSongs(songs: readonly InviteSong[]): InviteSongs {
  const added = [...songs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return {
    cover: toCover(added.map((song) => song.youtube_video_id)),
    names: added.slice(0, NAME_COUNT).map((song) => clipName(displayTitle(song.title))),
    count: songs.length,
  };
}

/** Pretendard 굵은 글씨의 대략 폭. 한글·가나·한자는 1em, 공백은 0.28em, 나머지는 0.56em. */
function widthEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (/[ᄀ-ᇿ぀-ヿ㄰-㆏一-鿿가-힣＀-￯…]/u.test(ch)) em += 1;
    else if (ch === " ") em += 0.28;
    else em += 0.56;
  }
  return em;
}

/**
 * 곡 이름 줄 "낭만고양이·벚꽃 엔딩" + "외 3곡". 두 이름이 maxEm 에 들어가지 않으면 첫 이름만 쓴다.
 * 말줄임표가 두 번 나오는 줄보다 이름 하나가 읽기 쉽다.
 */
export function inviteSongsLine(songs: InviteSongs, maxEm = Infinity): { names: string; more: string } {
  const line = (names: string[]) => {
    const rest = songs.count - names.length;
    return { names: names.join("·"), more: rest > 0 ? `외 ${rest}곡` : "" };
  };
  const both = line(songs.names);
  if (songs.names.length < 2 || widthEm(`${both.names} ${both.more}`) <= maxEm) return both;
  return line(songs.names.slice(0, 1));
}

/** 카톡 feed 설명과 og:description. 곡이 있으면 "N곡 등록" 대신 곡 이름을 쓴다. */
export function inviteDescription(songs: InviteSongs, participants: number): string {
  const { names, more } = inviteSongsLine(songs);
  const lead = names ? [names, more].filter(Boolean).join(" ") : `${songs.count}곡 등록`;
  return participants > 0 ? `${lead} · ${participants}명 참여 중` : `${lead} | 밴드 곡 투표에 참여하세요!`;
}
