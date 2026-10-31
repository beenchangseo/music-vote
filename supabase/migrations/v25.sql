-- Plypick v25: 새 플레이리스트의 셋리 편집 권한 DB 기본값을 '방장만'으로 맞춘다
-- Run after supabase/migrations/v24.sql. 코드 배포와 무관하다. 앱은 플레이리스트를 만들 때 setlist_edit_mode 를
-- 'host_only' 로 직접 넣어서(src/lib/room-insert.ts, #12) 이 기본값을 쓰지 않는다. 배포 전후 어느 쪽에 적용해도
-- 새 플레이리스트는 방장만 편집으로 시작한다.
--
-- 하는 일
--   playlists.setlist_edit_mode 의 기본값을 v10 의 'everyone' 에서 'host_only' 로 바꾼다 (#22).
--   #12 가 새 플레이리스트를 방장만 편집으로 시작하게 했는데 DB 기본값은 그대로여서, 이 컬럼을 빼고 INSERT 하는
--   경로(SQL Editor 에서 손으로 만든 행, 앞으로 생길 코드)는 모두 편집으로 시작했다. 이제 두 곳이 같은 값을 말한다.
--   기본값은 새 INSERT 에만 쓰인다. 이미 있는 행의 권한은 바꾸지 않는다.
--
-- 다시 실행해도 무해하다 (SET DEFAULT 는 같은 값을 다시 넣는다). 데이터를 바꾸지 않는다.

BEGIN;

ALTER TABLE playlists ALTER COLUMN setlist_edit_mode SET DEFAULT 'host_only';

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) 기본값. 기대값: 'host_only'::text
--
--   SELECT column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'playlists' AND column_name = 'setlist_edit_mode';
--
-- 2) 기존 행은 그대로다. 적용 전에 한 번, 뒤에 한 번 돌려 두 결과가 같아야 한다.
--
--   SELECT setlist_edit_mode, count(*) FROM playlists GROUP BY 1 ORDER BY 1;

-- ============================================================
-- 되돌리기
-- ============================================================
-- ALTER TABLE playlists ALTER COLUMN setlist_edit_mode SET DEFAULT 'everyone';
