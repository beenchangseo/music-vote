export interface Playlist {
  id: string;
  title: string;
  share_code: string;
  admin_token?: string;
  deadline: string | null;
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
