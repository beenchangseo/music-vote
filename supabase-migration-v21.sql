-- Plypick v21: 밴드를 어디서 만들었는지 teams 에 남긴다
-- Run after supabase-migration-v20.sql. **코드 배포 전에 실행** — 새 코드는 밴드를 만들 때 created_via 를 쓴다.
-- 순서를 어기면(코드 먼저) 홈의 새 밴드는 물론 플레이리스트에서 밴드로 올리기도 실패한다.
--
-- 배경 (docs/plans/2026-10-06-user-flow-map.md, eng 리뷰 O2)
--   6주 지표 "홈에서 만든 밴드 수"를 'promote 플레이리스트가 없는 밴드'로 추정하면, 방장이 원래 플레이리스트를
--   지운(deletePlaylist) 밴드가 홈 밴드로 잘못 세진다. 지금까지 만든 밴드는 모두 플레이리스트에서 올렸으므로
--   (홈 만들기가 없었다) 지금 기록을 시작하면 기존 행까지 정확하다.
--
-- 하는 일
--   teams.created_via: 'promote'(플레이리스트에서 올림) | 'home'(홈에서 빈 밴드)
--   DEFAULT 'promote' 로 기존 행이 채워지고, 이 SQL 과 코드 배포 사이에 옛 코드가 올린 밴드도 'promote' 로 남는다.
--   상수 DEFAULT 라 테이블을 다시 쓰지 않는다(PostgreSQL 11+). CHECK 는 행이 적어 바로 끝난다.
--
-- 다시 실행해도 무해하다 (ADD COLUMN IF NOT EXISTS — 컬럼이 있으면 CHECK 까지 통째로 건너뛴다).

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'promote'
  CHECK (created_via IN ('promote', 'home'));

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) 컬럼과 기본값. text · NO · 'promote'::text 여야 한다.
--
--   SELECT data_type, is_nullable, column_default FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'created_via';
--
-- 2) 기존 행. 배포 전에는 모두 promote 여야 한다.
--
--   SELECT created_via, count(*) FROM teams GROUP BY 1;
--
-- 3) 그다음 로컬 게이트 npm run test:e2e (account-a/band.spec.ts 가 올리기 경로를 확인한다).

-- ============================================================
-- 되돌리기
-- ============================================================
-- 먼저 코드를 직전 배포로 되돌린다(vercel rollback). 새 코드가 떠 있는 채로 컬럼을 지우면 밴드 만들기가 실패한다.
-- 옛 코드 아래에서는 컬럼을 그대로 둬도 무해하다(DEFAULT 가 채운다). 정말 지워야 할 때만 주석을 풀어 실행한다.
--
-- ALTER TABLE teams DROP COLUMN IF EXISTS created_via;
