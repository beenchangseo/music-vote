-- Plypick v16: 합주방 화면의 순차 왕복을 줄인다
-- Run after supabase-migration-v15.sql.
--
-- 배경
--   합주방 화면은 왕복을 세 번 순차로 기다렸다.
--     1) share_code 로 합주방 조회
--     2) 곡 목록            ← 1) 의 playlist_id 필요
--     3) 점수·투표자·댓글 수 ← 2) 의 song_id 목록 필요
--   투표 집계 뷰가 song_id 로만 키가 잡혀 있어 3) 이 2) 를 기다렸다.
--   뷰에 playlist_id 를 실어 2) 와 3) 을 한 번에 보낸다.
--   DB 가 먼 리전에 있을수록 이 한 번의 왕복 차이가 크다.

-- ============================================================
-- 투표 집계: playlist_id 추가
-- ============================================================
DROP VIEW IF EXISTS song_vote_summary;
CREATE VIEW song_vote_summary AS
SELECT
  s.playlist_id,
  v.song_id,
  (SUM(v.vote_type))::INT AS score,
  (COUNT(*))::INT AS vote_count,
  (COUNT(*) FILTER (WHERE v.user_id = auth.uid()))::INT AS my_vote_count,
  (MAX(v.vote_type) FILTER (WHERE v.user_id = auth.uid()))::SMALLINT AS my_vote_type
FROM votes v
JOIN songs s ON s.id = v.song_id
GROUP BY s.playlist_id, v.song_id;

GRANT SELECT ON song_vote_summary TO anon, authenticated;

-- 기명 합주방만 투표자를 드러낸다(ADR 0011).
DROP VIEW IF EXISTS song_voters;
CREATE VIEW song_voters AS
SELECT s.playlist_id, v.song_id, v.nickname, v.vote_type
FROM votes v
JOIN songs s ON s.id = v.song_id
JOIN playlists p ON p.id = s.playlist_id
WHERE p.votes_anonymous = false;

GRANT SELECT ON song_voters TO anon, authenticated;

-- ============================================================
-- 곡별 댓글·다른 버전 개수
-- ============================================================
-- 화면은 개수만 쓰는데 종전에는 두 테이블의 행을 모두 받아 세었다.
DROP VIEW IF EXISTS song_engagement_counts;
CREATE VIEW song_engagement_counts AS
SELECT
  s.playlist_id,
  s.id AS song_id,
  (SELECT COUNT(*) FROM comments c WHERE c.song_id = s.id)::INT AS comment_count,
  (SELECT COUNT(*) FROM song_versions sv WHERE sv.song_id = s.id)::INT AS version_count
FROM songs s;

GRANT SELECT ON song_engagement_counts TO anon, authenticated;

-- ============================================================
-- 적용 확인
-- ============================================================
--   SELECT playlist_id, song_id, score, my_vote_count
--   FROM song_vote_summary LIMIT 5;
--
--   SELECT playlist_id, song_id, comment_count, version_count
--   FROM song_engagement_counts LIMIT 5;
