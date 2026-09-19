-- Plypick v15: 공개 anon 키로 열려 있던 쓰기·조회 경로를 닫는다
-- Run after supabase-migration-v14.sql.
--
-- 배경
--   NEXT_PUBLIC_SUPABASE_ANON_KEY 는 브라우저에 그대로 노출된다.
--   지금까지 남아 있던 아래 정책들은 그 키만 있으면 누구나 쓸 수 있었다.
--     - playlists UPDATE USING (true)        → 합주방 탈취, 익명 해제, 제목·마감 변조
--     - songs UPDATE USING (true)            → 아무 곡이나 제목·URL·메타 변조
--     - votes/comments 의 user_id IS NULL    → 유령 표와 댓글 생성·삭제
--     - votes SELECT USING (true)            → 익명 합주방 투표자 조회
--   user_id IS NULL 예외는 로그인 이전 익명 합주방 때문에 열어둔 것이고,
--   그 합주방들은 v15 시점에 읽기 전용 보관 상태다(ADR 0012).
--
-- 앱에 미치는 영향
--   합주방 화면의 votes 조회만 아래 뷰로 바뀐다. 나머지 쓰기 경로는 모두
--   service_role 이나 SECURITY DEFINER 함수를 지나므로 그대로 동작한다.

-- ============================================================
-- 1. playlists: 직접 UPDATE 를 막는다
-- ============================================================
-- 앱은 방장 검사를 마친 뒤 service_role 로만 합주방을 수정한다.
DROP POLICY IF EXISTS "playlists_update" ON playlists;

-- ============================================================
-- 2. songs: 수정 차단, 등록은 본인 계정으로만
-- ============================================================
DROP POLICY IF EXISTS "songs_update" ON songs;

DROP POLICY IF EXISTS "songs_insert" ON songs;
CREATE POLICY "songs_insert" ON songs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = added_by_user_id);

-- ============================================================
-- 3. comments: 본인 계정 행만
-- ============================================================
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ============================================================
-- 4. votes: 직접 접근 전면 차단
-- ============================================================
-- 쓰기는 cast_playlist_vote(SECURITY DEFINER)와 service_role 만 한다.
-- 읽기는 아래 뷰로만 한다.
DROP POLICY IF EXISTS "votes_select" ON votes;
DROP POLICY IF EXISTS "votes_insert" ON votes;
DROP POLICY IF EXISTS "votes_update" ON votes;
DROP POLICY IF EXISTS "votes_delete" ON votes;

REVOKE ALL ON votes FROM anon, authenticated;

-- ============================================================
-- 5. 투표 조회 뷰
-- ============================================================
-- SECURITY DEFINER(기본값)로 두어 votes 권한을 회수한 뒤에도 읽을 수 있다.
-- 누가 무엇을 찍었는지는 담지 않고, 내 표만 auth.uid() 로 골라 준다.
DROP VIEW IF EXISTS song_vote_summary;
CREATE VIEW song_vote_summary AS
SELECT
  v.song_id,
  (SUM(v.vote_type))::INT AS score,
  (COUNT(*))::INT AS vote_count,
  (COUNT(*) FILTER (WHERE v.user_id = auth.uid()))::INT AS my_vote_count,
  (MAX(v.vote_type) FILTER (WHERE v.user_id = auth.uid()))::SMALLINT AS my_vote_type
FROM votes v
GROUP BY v.song_id;

GRANT SELECT ON song_vote_summary TO anon, authenticated;

-- 기명 합주방만 투표자를 드러낸다(ADR 0011).
DROP VIEW IF EXISTS song_voters;
CREATE VIEW song_voters AS
SELECT v.song_id, v.nickname, v.vote_type
FROM votes v
JOIN songs s ON s.id = v.song_id
JOIN playlists p ON p.id = s.playlist_id
WHERE p.votes_anonymous = false;

GRANT SELECT ON song_voters TO anon, authenticated;

-- ============================================================
-- 6. v14 통계 뷰를 SECURITY DEFINER 로 되돌린다
-- ============================================================
-- security_invoker = on 이면 votes 권한 회수와 함께 집계가 막힌다.
DROP VIEW IF EXISTS playlist_stats;
CREATE VIEW playlist_stats AS
SELECT
  p.id AS playlist_id,
  COUNT(DISTINCT s.id)::INT AS song_count,
  COUNT(v.id)::INT AS vote_count,
  COUNT(DISTINCT COALESCE(v.user_id::TEXT, lower(v.nickname)))::INT AS participant_count
FROM playlists p
LEFT JOIN songs s ON s.playlist_id = p.id
LEFT JOIN votes v ON v.song_id = s.id
GROUP BY p.id;

GRANT SELECT ON playlist_stats TO anon, authenticated;

DROP VIEW IF EXISTS home_stats;
CREATE VIEW home_stats AS
SELECT
  (SELECT COUNT(*) FROM playlists)::INT AS playlist_count,
  (SELECT COUNT(*) FROM songs)::INT AS song_count,
  (SELECT COUNT(DISTINCT COALESCE(user_id::TEXT, lower(nickname))) FROM votes)::INT AS participant_count;

GRANT SELECT ON home_stats TO anon, authenticated;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 아래를 실행해 남아 있는 공개 정책이 없는지 본다.
-- votes 는 행이 0건이어야 하고, playlists/songs 에 UPDATE 정책이 없어야 한다.
--
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('votes', 'playlists', 'songs', 'comments')
--   ORDER BY tablename, cmd;
--
-- 뷰 네 개가 모두 SECURITY DEFINER(= security_invoker 옵션 없음)인지 본다.
--
--   SELECT c.relname, c.reloptions
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public'
--     AND c.relname IN ('song_vote_summary', 'song_voters', 'playlist_stats', 'home_stats');
