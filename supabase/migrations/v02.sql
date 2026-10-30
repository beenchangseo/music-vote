-- Music Vote v2 Migration
-- Run this in Supabase SQL Editor (after initial schema)

-- Add deadline column to playlists
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
