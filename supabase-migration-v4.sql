-- Plypick v4 Migration: Creator nickname for admin detection
-- Run this in Supabase SQL Editor (after v3 migration)

-- Add creator_nickname to playlists for admin detection without localStorage
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS creator_nickname TEXT;
