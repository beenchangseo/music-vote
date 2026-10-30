-- Plypick v13: 로그인 참여자의 후보곡 중복 투표를 막는 legacy 닉네임 제약 제거
-- Run after supabase-migration-v12.sql.

-- 초기 스키마의 전체 UNIQUE(song_id, nickname)는 로그인 참여자의 중복표도 막는다.
ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_song_id_nickname_key;

-- 로그인 이전 합주방은 기존 후보곡당 닉네임 1표 제약을 유지한다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_votes_song_legacy_nickname
  ON votes(song_id, nickname)
  WHERE user_id IS NULL;
