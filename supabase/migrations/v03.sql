-- Plypick v3 Migration: Band Management Features
-- Run this in Supabase SQL Editor (after v1 schema + v2 migration)

-- Ensure citext extension
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================
-- ALTER playlists: add setlist/announcement columns
-- ============================================
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS setlist_count INT;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS announcement TEXT;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS setlist_confirmed BOOLEAN DEFAULT false;

-- ============================================
-- ALTER songs: add rehearsal metadata columns
-- ============================================
ALTER TABLE songs ADD COLUMN IF NOT EXISTS key_memo TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS tempo_bpm INT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration_seconds INT;

-- Add UPDATE policy for songs (needed for key_memo, tempo_bpm, duration_seconds edits)
CREATE POLICY "songs_update" ON songs FOR UPDATE USING (true);

-- ============================================
-- New table: comments (per-song, one per nickname)
-- ============================================
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  nickname CITEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(song_id, nickname)
);

CREATE INDEX idx_comments_song ON comments(song_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (true);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (true);

-- ============================================
-- New table: setlist_items (ordered items: songs + interval blocks)
-- ============================================
CREATE TABLE setlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  position INT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('song', 'interval')),
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  label TEXT,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_setlist_items_playlist ON setlist_items(playlist_id, position);

ALTER TABLE setlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "setlist_items_select" ON setlist_items FOR SELECT USING (true);
CREATE POLICY "setlist_items_insert" ON setlist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "setlist_items_update" ON setlist_items FOR UPDATE USING (true);
CREATE POLICY "setlist_items_delete" ON setlist_items FOR DELETE USING (true);

-- ============================================
-- UPDATE policy for playlists (needed for announcement, setlist_confirmed)
-- ============================================
CREATE POLICY "playlists_update" ON playlists FOR UPDATE USING (true);
