-- v8: 로그인 모드 행에 대한 RLS 강화
-- user_id 가 채워진 행(로그인 모드)은 본인만 update/delete/insert(자기 id) 가능.
-- user_id 가 NULL 인 행(익명 모드 legacy)은 종전대로 누구나 가능 (action 레이어에서 nickname 기반 게이팅).
--
-- 멱등 적용: 기존 정책 DROP IF EXISTS 후 재생성.

-- ============================================
-- votes
-- ============================================
DROP POLICY IF EXISTS "votes_insert" ON votes;
CREATE POLICY "votes_insert" ON votes
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_update" ON votes;
CREATE POLICY "votes_update" ON votes
  FOR UPDATE
  USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_delete" ON votes;
CREATE POLICY "votes_delete" ON votes
  FOR DELETE
  USING (user_id IS NULL OR auth.uid() = user_id);

-- ============================================
-- comments
-- ============================================
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments
  FOR UPDATE
  USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE
  USING (user_id IS NULL OR auth.uid() = user_id);

-- ============================================
-- songs (INSERT 시 added_by_user_id 본인만)
-- ============================================
DROP POLICY IF EXISTS "songs_insert" ON songs;
CREATE POLICY "songs_insert" ON songs
  FOR INSERT
  WITH CHECK (added_by_user_id IS NULL OR auth.uid() = added_by_user_id);
