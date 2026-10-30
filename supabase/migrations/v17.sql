-- Plypick v17: YouTube 검색 결과 캐시
-- Run after supabase-migration-v16.sql.
--
-- 배경
--   YouTube Data API 의 search.list 는 하루 100회 전용 쿼터다. 나머지
--   엔드포인트가 공유하는 10,000 유닛과 별도이고, 전체 사용자 합산이다.
--   밴드들은 비슷한 곡을 찾으므로 같은 검색어를 캐시하면 호출이 크게 준다.
--
--   보관 기간은 24시간으로 짧게 둔다. YouTube Developer Policies 가 API 로
--   받아온 데이터의 갱신·삭제 주기를 정하고 있어, 길게 쌓아두지 않는다.

CREATE TABLE IF NOT EXISTS youtube_search_cache (
  -- 정규화한 검색어(trim + 소문자)
  query TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_search_cache_created
  ON youtube_search_cache(created_at);

-- 서버 액션이 service_role 로만 접근한다. 공개 키에는 열지 않는다.
ALTER TABLE youtube_search_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_search_cache_select" ON youtube_search_cache;
DROP POLICY IF EXISTS "youtube_search_cache_insert" ON youtube_search_cache;

REVOKE ALL ON youtube_search_cache FROM anon, authenticated;

-- ============================================================
-- 적용 확인
-- ============================================================
--   SELECT count(*) FROM youtube_search_cache;
--
-- 오래된 항목 정리 (필요할 때 수동 실행)
--   DELETE FROM youtube_search_cache WHERE created_at < now() - interval '24 hours';
