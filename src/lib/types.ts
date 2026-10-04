export interface Playlist {
  id: string;
  title: string;
  share_code: string;
  admin_token?: string;
  deadline: string | null;
  setlist_count: number | null;
  announcement: string | null;
  setlist_confirmed: boolean;
  creator_nickname: string | null;
  creator_user_id: string | null;
  votes_anonymous: boolean;
  voting_mode: VotingMode;
  default_vote_limit: number;
  setlist_edit_mode: SetlistEditMode;
  created_at: string;
  /** 방이 속한 밴드 (v19). 팀 없는 방은 null. */
  team_id?: string | null;
}

/**
 * 방 화면에 내리는 밴드 정보 (계획 §3 "팀 방 페이지 데이터" 표).
 * 초대 코드는 어느 쪽에도 싣지 않는다 (R10). 방 링크는 공개라 그걸로 밴드에 들어올 수 없어야 한다.
 */
export interface RoomTeam {
  /** 경로 줄·"밴드 홈" 링크용. 밴드 멤버에게만, 비멤버는 null. */
  id: string | null;
  /** 멤버, 또는 방장인 비멤버("{밴드} 의 방" 표시)에게만. 그 외 null. */
  name: string | null;
  /** 공개 값 (band 카드에도 나간다). 방 카드 접두어에 쓴다. */
  nextShowAt: string | null;
  isMember: boolean;
}

export type VotingMode = "free" | "allocated";
export type SetlistEditMode = "everyone" | "host_only";

export type KeyRoot =
  | "C" | "C#" | "D" | "D#" | "E" | "F"
  | "F#" | "G" | "G#" | "A" | "A#" | "B";
export type KeyMode = "major" | "minor";
export type Genre =
  | "rock" | "pop" | "ballad" | "indie" | "punk" | "metal"
  | "jazz" | "hiphop" | "rnb" | "electronic" | "kpop" | "other";
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Song {
  id: string;
  playlist_id: string;
  title: string;
  artist: string | null;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string | null;
  added_by: string | null;
  added_by_user_id: string | null;
  key_memo: string | null;
  key_root: KeyRoot | null;
  key_mode: KeyMode | null;
  tempo_bpm: number | null;
  duration_seconds: number | null;
  difficulty: Difficulty | null;
  genre: Genre | null;
  created_at: string;
}

/**
 * 화면으로 내려보내는 투표 정보. 기명 모드에서만 채워진다.
 * 계정 식별자는 포함하지 않는다.
 */
export interface SongVoteRow {
  song_id: string;
  nickname: string;
  vote_type: number; // 1 or -1
}

export interface SongWithScore extends Song {
  score: number;
  votes: SongVoteRow[];
  userVote: number | null; // 1, -1, or null
  userVoteCount: number;
  commentCount: number;
  versionCount: number;
}

export interface Comment {
  id: string;
  song_id: string;
  nickname: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SetlistItem {
  id: string;
  playlist_id: string;
  position: number;
  item_type: "song" | "interval";
  song_id: string | null;
  label: string | null;
  description: string | null;
  duration_seconds: number;
  title_override: string | null;
  duration_override_seconds: number | null;
  created_at: string;
}

export interface PlaylistMember {
  playlist_id: string;
  user_id: string;
  display_name: string;
  vote_limit: number;
  used_votes: number;
  joined_at: string;
}

export interface VoteAllowance {
  mode: VotingMode;
  voteLimit: number;
  usedVotes: number;
}

export interface SongVersion {
  id: string;
  song_id: string;
  youtube_url: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  description: string | null;
  added_by_user_id: string | null;
  added_by_nickname: string;
  created_at: string;
  updated_at: string;
}

/** 코드·DB 의 team = 화면의 "밴드" (ADR 0014). */
export type TeamRole = "owner" | "member";

/** 방이 밴드에 들어온 경로 (v19 playlists.team_linked_via). */
export type TeamLinkedVia = "promote" | "band" | "attach";

export interface Team {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  /** KST 달력 날짜 YYYY-MM-DD. */
  next_show_at: string | null;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  display_name: string;
  role: TeamRole;
  joined_at: string;
}

/**
 * 예상된 실패를 throw 하지 않고 돌려주는 서버 액션의 결과 (castVote 와 같은 모양).
 * 화면은 reason 코드를 src/lib/team-messages.ts 로 한국어 문구로 바꾼다.
 */
export type ActionResult<T extends object = Record<never, never>, R extends string = string> =
  | ({ success: true } & T)
  | { success: false; reason: R };
