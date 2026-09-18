-- Plypick v14: votes 조회 인덱스 복구 + 통계 집계 뷰
-- Run after supabase-migration-v13.sql.

-- ============================================================
-- votes(song_id) 인덱스 복구
-- ============================================================
-- v1 스키마의 UNIQUE(song_id, nickname) 제약은 song_id 선두 인덱스를 함께 제공했는데,
-- v13이 그 제약을 제거하면서 남은 두 부분 인덱스로는 WHERE song_id = ? 를 탈 수 없게 됐다.
-- 합주방 화면이 매번 쓰는 조회 경로라 전체 인덱스를 다시 만든다.
CREATE INDEX IF NOT EXISTS idx_votes_song_id ON votes(song_id);

-- ============================================================
-- 합주방별 집계
-- ============================================================
-- 후보곡 수, 표 수, 참여자 수를 DB에서 집계한다.
-- 참여자는 로그인 계정이 있으면 user_id로, 익명 합주방은 소문자 닉네임으로 센다.
CREATE OR REPLACE VIEW playlist_stats
WITH (security_invoker = on)
AS
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

-- ============================================================
-- 홈 통계
-- ============================================================
-- 기존 코드는 votes 전체를 가져와 애플리케이션에서 distinct 했다.
-- PostgREST 기본 1000행 상한 때문에 표가 1000개를 넘으면 멤버 수가 멈춘다.
CREATE OR REPLACE VIEW home_stats
WITH (security_invoker = on)
AS
SELECT
  (SELECT COUNT(*) FROM playlists)::INT AS playlist_count,
  (SELECT COUNT(*) FROM songs)::INT AS song_count,
  (SELECT COUNT(DISTINCT COALESCE(user_id::TEXT, lower(nickname))) FROM votes)::INT AS participant_count;

GRANT SELECT ON home_stats TO anon, authenticated;
