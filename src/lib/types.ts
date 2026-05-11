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
  votes_anonymous: boolean;
  created_at: string;
}

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
  key_memo: string | null;
  key_root: KeyRoot | null;
  key_mode: KeyMode | null;
  tempo_bpm: number | null;
  duration_seconds: number | null;
  difficulty: Difficulty | null;
  genre: Genre | null;
  created_at: string;
}

export interface Vote {
  id: string;
  song_id: string;
  nickname: string;
  vote_type: number; // 1 or -1
  created_at: string;
}

export interface SongWithScore extends Song {
  score: number;
  votes: Vote[];
  userVote: number | null; // 1, -1, or null
  commentCount: number;
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
  duration_seconds: number;
  created_at: string;
}
