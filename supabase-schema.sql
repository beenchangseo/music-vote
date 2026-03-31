-- Music Vote Database Schema
-- Run this in Supabase SQL Editor

-- Enable CITEXT extension for case-insensitive nicknames
CREATE EXTENSION IF NOT EXISTS citext;

-- Playlists table (public info only)
CREATE TABLE playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Playlist admin tokens (separate table, service role only)
CREATE TABLE playlist_admin (
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE PRIMARY KEY,
  admin_token TEXT NOT NULL
);

-- Songs table
CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_songs_playlist_id ON songs(playlist_id);

-- Votes table
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  nickname CITEXT NOT NULL,
  vote_type SMALLINT NOT NULL CHECK (vote_type IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(song_id, nickname)
);

-- Row Level Security Policies

-- Playlists: public read/insert (no admin_token column to leak)
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists_select" ON playlists FOR SELECT USING (true);
CREATE POLICY "playlists_insert" ON playlists FOR INSERT WITH CHECK (true);

-- Playlist admin: NO anon access. Only service role can read/write.
ALTER TABLE playlist_admin ENABLE ROW LEVEL SECURITY;
-- No policies = denied for anon role, accessible only via service_role key

-- Songs: public read/insert, delete via service role only
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "songs_select" ON songs FOR SELECT USING (true);
CREATE POLICY "songs_insert" ON songs FOR INSERT WITH CHECK (true);

-- Votes: full CRUD for vote toggle support
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_update" ON votes FOR UPDATE USING (true);
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (true);
