-- v7: Kakao OAuth 계정 연동
-- Supabase Auth (auth.users) 의 user_id 를 주요 테이블에 추가.
-- 기존 익명(nickname) 흐름은 그대로 유지하고, 로그인 사용자는 user_id 로 식별.
-- Kakao provider 활성화는 Supabase Dashboard > Authentication > Providers 에서 수행.

-- ============================================
-- playlists: 생성자(로그인 유저) 추적
-- ============================================
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS creator_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_creator_user
  ON playlists(creator_user_id)
  WHERE creator_user_id IS NOT NULL;

-- ============================================
-- songs: 추가한 로그인 유저
-- ============================================
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS added_by_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- votes: 로그인 유저 단위 1표 (nickname 흐름과 공존)
-- ============================================
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_votes_song_user
  ON votes(song_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_votes_user
  ON votes(user_id)
  WHERE user_id IS NOT NULL;

-- ============================================
-- comments: 로그인 유저 단위 1댓글
-- ============================================
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comments_song_user
  ON comments(song_id, user_id)
  WHERE user_id IS NOT NULL;

-- ============================================
-- playlist_members: 플레이리스트에 참여한 로그인 유저(밴드 멤버)
-- ============================================
CREATE TABLE IF NOT EXISTS playlist_members (
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (playlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_members_user
  ON playlist_members(user_id);

ALTER TABLE playlist_members ENABLE ROW LEVEL SECURITY;

-- SELECT 공개 (UI 게이팅으로 표시 제어)
DROP POLICY IF EXISTS "members_select" ON playlist_members;
CREATE POLICY "members_select" ON playlist_members FOR SELECT USING (true);

-- 본인만 가입/탈퇴 가능
DROP POLICY IF EXISTS "members_insert" ON playlist_members;
CREATE POLICY "members_insert" ON playlist_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "members_update" ON playlist_members;
CREATE POLICY "members_update" ON playlist_members
  FOR UPDATE USING (auth.uid() = user_id);
