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
  created_at: string;
}

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
  tempo_bpm: number | null;
  duration_seconds: number | null;
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
